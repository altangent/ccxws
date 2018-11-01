const { EventEmitter } = require("events");
const winston = require("winston");
const semaphore = require("semaphore");
const { wait } = require("../util");
const https = require("../https");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const SmartWss = require("../smart-wss");
const Watcher = require("../watcher");

class BinanceClient extends EventEmitter {
  constructor({ useAggTrades = true, requestSnapshot = true } = {}) {
    super();
    this._name = "Binance";
    this._tickerSubs = new Map();
    this._tradeSubs = new Map();
    this._level2SnapshotSubs = new Map();
    this._level2UpdateSubs = new Map();
    this._wss = undefined;
    this._reconnectDebounce = undefined;

    this.requestSnapshot = requestSnapshot;
    this.useAggTrades = useAggTrades;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;

    this._watcher = new Watcher(this, 30000);
    this._restSem = semaphore(1);
    this.REST_REQUEST_DELAY_MS = 250;
  }

  //////////////////////////////////////////////

  subscribeTicker(market) {
    this._subscribe(market, "subscribing to ticker", this._tickerSubs);
  }

  unsubscribeTicker(market) {
    this._unsubscribe(market, "unsubscribing from ticker", this._tickerSubs);
  }

  subscribeTrades(market) {
    this._subscribe(market, "subscribing to trades", this._tradeSubs);
  }

  unsubscribeTrades(market) {
    this._unsubscribe(market, "unsubscribing to trades", this._tradeSubs);
  }

  subscribeLevel2Snapshots(market) {
    this._subscribe(market, "subscribing to l2 snapshots", this._level2SnapshotSubs);
  }

  unsubscribeLevel2Snapshots(market) {
    this._unsubscribe(market, "unsubscribing from l2 snapshots", this._level2SnapshotSubs);
  }

  subscribeLevel2Updates(market) {
    this._subscribe(market, "subscribing to l2 upates", this._level2UpdateSubs);
  }

  unsubscribeLevel2Updates(market) {
    this._unsubscribe(market, "unsubscribing from l2 updates", this._level2UpdateSubs);
  }

  reconnect() {
    winston.info("reconnecting");
    this._reconnect();
    this.emit("reconnected");
  }

  close() {
    this._close();
  }

  ////////////////////////////////////////////
  // PROTECTED

  _subscribe(market, msg, map) {
    let remote_id = market.id.toLowerCase();
    if (!map.has(remote_id)) {
      winston.info(msg, this._name, remote_id);
      map.set(remote_id, market);
      this._reconnect();
    }
  }

  _unsubscribe(market, msg, map) {
    let remote_id = market.id.toLowerCase();
    if (map.has(remote_id)) {
      winston.info(msg, this._name, remote_id);
      map.delete(market);
      this._reconnect();
    }
  }

  /**
   * Reconnects the socket after a debounce period
   * so that multiple calls don't cause connect/reconnect churn
   */
  _reconnect() {
    clearTimeout(this._reconnectDebounce);
    this._reconnectDebounce = setTimeout(() => {
      this._close();
      this._connect();
    }, 100);
  }

  /**
   * Close the underlying connction, which provides a way to reset the things
   */
  _close() {
    if (this._wss) {
      this._wss.close();
      this._wss = undefined;
      this.emit("closed");
    }
  }

  /** Connect to the websocket stream by constructing a path from
   * the subscribed markets.
   */
  _connect() {
    if (!this._wss) {
      let streams = [].concat(
        Array.from(this._tradeSubs.keys()).map(
          p => p + (this.useAggTrades ? "@aggTrade" : "@trade")
        ),
        Array.from(this._level2SnapshotSubs.keys()).map(p => p + "@depth20"),
        Array.from(this._level2UpdateSubs.keys()).map(p => p + "@depth")
      );
      if (this._tickerSubs.size > 0) {
        streams.push("!ticker@arr");
      }

      let wssPath = "wss://stream.binance.com:9443/stream?streams=" + streams.join("/");

      this._wss = new SmartWss(wssPath);
      this._wss.on("message", this._onMessage.bind(this));
      this._wss.on("open", this._onConnected.bind(this));
      this._wss.on("disconnected", this._onDisconnected.bind(this));
      this._wss.connect();
    }
  }

  ////////////////////////////////////////////
  // ABSTRACT

  _onConnected() {
    this._watcher.start();
    this._requestLevel2Snapshots(); // now that we're connected...
    this.emit("connected");
  }

  _onDisconnected() {
    this._watcher.stop();
    this.emit("disconnected");
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    // ticker
    if (msg.stream === "!ticker@arr") {
      for (let raw of msg.data) {
        if (this._tickerSubs.has(raw.s.toLowerCase())) {
          let ticker = this._constructTicker(raw);
          this.emit("ticker", ticker);
        }
      }
    }

    // trades
    if (msg.stream.toLowerCase().endsWith("trade")) {
      let trade = this.useAggTrades ? this._constructAggTrade(msg) : this._constructRawTrade(msg);
      this.emit("trade", trade);
    }

    // l2snapshot
    if (msg.stream.endsWith("depth20")) {
      let snapshot = this._constructLevel2Snapshot(msg);
      this.emit("l2snapshot", snapshot);
    }

    // l2update
    if (msg.stream.endsWith("depth")) {
      let update = this._constructLevel2Update(msg);
      this.emit("l2update", update);
    }
  }

  _constructTicker(msg) {
    let {
      E: timestamp,
      s: symbol,
      c: last,
      v: volume,
      q: quoteVolume,
      h: high,
      l: low,
      p: change,
      P: changePercent,
      a: ask,
      A: askVolume,
      b: bid,
      B: bidVolume,
    } = msg;
    let market = this._tickerSubs.get(symbol.toLowerCase());
    let open = parseFloat(last) + parseFloat(change);
    return new Ticker({
      exchange: "Binance",
      base: market.base,
      quote: market.quote,
      timestamp: timestamp * 1000,
      last,
      open: open.toFixed(8),
      high,
      low,
      volume,
      quoteVolume,
      change,
      changePercent,
      bid,
      bidVolume,
      ask,
      askVolume,
    });
  }

  _constructAggTrade({ data }) {
    let { s: symbol, a: trade_id, p: price, q: size, T: time, m: buyer } = data;
    let market = this._tradeSubs.get(symbol.toLowerCase());
    let unix = time;
    let amount = size;
    let side = buyer ? "buy" : "sell";
    return new Trade({
      exchange: "Binance",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id,
      unix,
      side,
      price,
      amount,
    });
  }

  _constructRawTrade({ data }) {
    let {
      s: symbol,
      t: trade_id,
      p: price,
      q: size,
      b: buyOrderId,
      a: sellOrderId,
      T: time,
      m: buyer,
    } = data;
    let market = this._tradeSubs.get(symbol.toLowerCase());
    let unix = time;
    let amount = size;
    let side = buyer ? "buy" : "sell";
    return new Trade({
      exchange: "Binance",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id,
      unix,
      side,
      price,
      amount,
      buyOrderId,
      sellOrderId,
    });
  }

  _constructLevel2Snapshot(msg) {
    let remote_id = msg.stream.split("@")[0];
    let market = this._level2SnapshotSubs.get(remote_id);
    let sequenceId = msg.data.lastUpdateId;
    let asks = msg.data.asks.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.data.bids.map(p => new Level2Point(p[0], p[1]));
    return new Level2Snapshot({
      exchange: "Binance",
      base: market.base,
      quote: market.quote,
      sequenceId,
      asks,
      bids,
    });
  }

  _constructLevel2Update(msg) {
    let remote_id = msg.data.s.toLowerCase();
    let market = this._level2UpdateSubs.get(remote_id);
    let sequenceId = msg.data.U;
    let lastSequenceId = msg.data.u;
    let asks = msg.data.a.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.data.b.map(p => new Level2Point(p[0], p[1]));
    return new Level2Update({
      exchange: "Binance",
      base: market.base,
      quote: market.quote,
      sequenceId,
      lastSequenceId,
      asks,
      bids,
    });
  }

  _requestLevel2Snapshots() {
    if (this.requestSnapshot) {
      for (let market of this._level2UpdateSubs.values()) {
        this._requestLevel2Snapshot(market);
      }
    }
  }

  async _requestLevel2Snapshot(market) {
    this._restSem.take(async () => {
      try {
        winston.info(`requesting snapshot for ${market.id}`);
        let remote_id = market.id;
        let uri = `https://api.binance.com/api/v1/depth?limit=1000&symbol=${remote_id}`;
        let raw = await https.get(uri);
        let sequenceId = raw.lastUpdateId;
        let asks = raw.asks.map(p => new Level2Point(p[0], p[1]));
        let bids = raw.bids.map(p => new Level2Point(p[0], p[1]));
        let snapshot = new Level2Snapshot({
          exchange: "Binance",
          base: market.base,
          quote: market.quote,
          sequenceId,
          asks,
          bids,
        });
        this.emit("l2snapshot", snapshot);
      } catch (ex) {
        winston.warn(`failed to fetch snapshot for ${market.id} - ${ex}`);
        this._requestLevel2Snapshot(market);
      } finally {
        await wait(this.REST_REQUEST_DELAY_MS);
        this._restSem.leave();
      }
    });
  }
}

module.exports = BinanceClient;
