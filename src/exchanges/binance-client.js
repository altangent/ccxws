const { EventEmitter } = require("events");
const semaphore = require("semaphore");
const { wait } = require("../util");
const https = require("../https");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Candle = require("../candle");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const SmartWss = require("../smart-wss");
const Watcher = require("../watcher");
const { CandlePeriod } = require("../enums");
const { candlePeriod } = require("./binance-base");

class BinanceClient extends EventEmitter {
  constructor({ useAggTrades = true, requestSnapshot = true, reconnectIntervalMs = 300000 } = {}) {
    super();
    this._name = "Binance";
    this._tickerSubs = new Map();
    this._tradeSubs = new Map();
    this._candleSubs = new Map();
    this._level2SnapshotSubs = new Map();
    this._level2UpdateSubs = new Map();
    this._wss = undefined;
    this._reconnectDebounce = undefined;

    this.requestSnapshot = requestSnapshot;
    this.useAggTrades = useAggTrades;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;

    this.candlePeriod = CandlePeriod._1m;

    this._watcher = new Watcher(this, reconnectIntervalMs);
    this._restSem = semaphore(1);
    this.REST_REQUEST_DELAY_MS = 1000;

    this._messageId = 0;
  }

  get subCount() {
    return (
      this._tickerSubs.size +
      this._tradeSubs.size +
      this._candleSubs.size +
      this._level2SnapshotSubs.size +
      this._level2UpdateSubs.size
    );
  }

  //////////////////////////////////////////////

  subscribeTicker(market) {
    this._subscribe(market, this._tickerSubs);
  }

  unsubscribeTicker(market) {
    this._unsubscribe(market, this._tickerSubs);
  }

  subscribeTrades(market) {
    this._subscribe(market, this._tradeSubs);
  }

  unsubscribeTrades(market) {
    this._unsubscribe(market, this._tradeSubs);
  }

  subscribeCandles(market) {
    this._subscribe(market, this._candleSubs);
  }

  unsubscribeCandles(market) {
    this._unsubscribe(market, this._candleSubs);
  }

  subscribeLevel2Snapshots(market) {
    this._subscribe(market, this._level2SnapshotSubs);
  }

  unsubscribeLevel2Snapshots(market) {
    this._unsubscribe(market, this._level2SnapshotSubs);
  }

  subscribeLevel2Updates(market) {
    this._subscribe(market, this._level2UpdateSubs);
  }

  unsubscribeLevel2Updates(market) {
    this._unsubscribe(market, this._level2UpdateSubs);
  }

  reconnect() {
    this._reconnect();
  }

  close() {
    this._close();
  }

  ////////////////////////////////////////////
  // PROTECTED

  _subscribe(market, map) {
    let remote_id = market.id.toLowerCase();
    if (!map.has(remote_id)) {
      if (!this._wss) {
        map.set(remote_id, market);
        this._reconnect();
      } else {
        const oldStreams = this._buildStreams();
        map.set(remote_id, market);
        const newStreams = this._buildStreams();
        const subscribeStreams = newStreams.filter(stream => !oldStreams.includes(stream));

        if (!subscribeStreams.length) {
          return;
        }

        const request = {
          method: "SUBSCRIBE",
          params: subscribeStreams,
          id: this._createMessageId(),
        };

        // as we are not reconnecting, we have to
        // request the snapshot for l2 updates
        for (const stream of subscribeStreams) {
          if (stream.endsWith('@depth')) {
            this._requestLevel2Snapshot(market);
          }
        }

        this._wss.send(JSON.stringify(request));
      }
    }
  }

  _unsubscribe(market, map) {
    let remote_id = market.id.toLowerCase();
    if (map.has(remote_id)) {
      if (!this._wss) {
        map.delete(remote_id);
        this._reconnect();
      } else {
        const oldStreams = this._buildStreams();
        map.delete(remote_id);
        const newStreams = this._buildStreams();
        const subscribeStreams = oldStreams.filter(stream => !newStreams.includes(stream));

        if (!subscribeStreams.length) {
          return;
        }

        const request = {
          method: "UNSUBSCRIBE",
          params: subscribeStreams,
          id: this._createMessageId(),
        };
        this._wss.send(JSON.stringify(request));
      }
    }
  }

  /**
   * Reconnects the socket after a debounce period
   * so that multiple calls don't cause connect/reconnect churn
   */
  _reconnect() {
    clearTimeout(this._reconnectDebounce);
    if (this.subCount === 0) return;
    this._reconnectDebounce = setTimeout(() => {
      this.emit("reconnecting");
      if (this._wss) {
        this._wss.once("closed", () => this._connect());
        this._close();
      } else {
        this._connect();
      }
    }, 100);
  }

  /**
   * Close the underlying connction, which provides a way to reset the things
   */
  _close() {
    this._watcher.stop();
    if (this._wss) {
      this._wss.close();
      this._wss = undefined;
    }
  }

  /** Connect to the websocket stream by constructing a path from
   * the subscribed markets.
   */
  _connect() {
    if (!this._wss) {
      const streams = this._buildStreams();
      let wssPath = "wss://stream.binance.com:9443/stream?streams=" + streams.join("/");

      this._wss = new SmartWss(wssPath);
      this._wss.on("error", this._onError.bind(this));
      this._wss.on("connecting", this._onConnecting.bind(this));
      this._wss.on("connected", this._onConnected.bind(this));
      this._wss.on("disconnected", this._onDisconnected.bind(this));
      this._wss.on("closing", this._onClosing.bind(this));
      this._wss.on("closed", this._onClosed.bind(this));
      this._wss.on("message", msg => {
        try {
          this._onMessage(msg);
        } catch (ex) {
          this._onError(ex);
        }
      });
      this._wss.connect();
    }
  }

  ////////////////////////////////////////////
  // ABSTRACT

  _onError(err) {
    if (err.message === "Invalid WebSocket frame: invalid status code 1005") return;
    this.emit("error", err);
  }

  _onConnecting() {
    this.emit("connecting");
  }

  _onConnected() {
    this._watcher.start();
    this._requestLevel2Snapshots(); // now that we're connected...
    this.emit("connected");
  }

  _onDisconnected() {
    this._watcher.stop();
    this.emit("disconnected");
  }

  _onClosing() {
    this._watcher.stop();
    this.emit("closing");
  }

  _onClosed() {
    this.emit("closed");
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    // incremental subscribe/unsubscribe responses
    if (!msg.stream && !msg.data && msg.id) {
      if (msg.result !== null) {
        this.emit("error", msg.result);

      }
      return;
    }

    // ticker
    if (msg.stream === "!ticker@arr") {
      for (let raw of msg.data) {
        let remote_id = raw.s.toLowerCase();
        let market = this._tickerSubs.get(remote_id);
        if (!market) continue;

        let ticker = this._constructTicker(raw, market);
        this.emit("ticker", ticker, market);
      }
    }

    // trades
    if (msg.stream.toLowerCase().endsWith("trade")) {
      let remote_id = msg.data.s.toLowerCase();
      let market = this._tradeSubs.get(remote_id);
      if (!market) return;

      let trade = this.useAggTrades
        ? this._constructAggTrade(msg, market)
        : this._constructRawTrade(msg, market);
      this.emit("trade", trade, market);
      return;
    }

    // candle
    if (msg.data.e === "kline") {
      let remote_id = msg.data.s.toLowerCase();
      let market = this._candleSubs.get(remote_id);
      if (!market) return;

      let candle = this._constructCandle(msg, market);
      this.emit("candle", candle, market);
      return;
    }

    // l2snapshot
    if (msg.stream.endsWith("depth20")) {
      let remote_id = msg.stream.split("@")[0];
      let market = this._level2SnapshotSubs.get(remote_id);
      if (!market) return;

      let snapshot = this._constructLevel2Snapshot(msg, market);
      this.emit("l2snapshot", snapshot, market);
      return;
    }

    // l2update
    if (msg.stream.endsWith("depth")) {
      let remote_id = msg.stream.split("@")[0];
      let market = this._level2UpdateSubs.get(remote_id);
      if (!market) return;

      let update = this._constructLevel2Update(msg, market);
      this.emit("l2update", update, market);
      return;
    }
  }

  _constructTicker(msg, market) {
    let {
      E: timestamp,
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
    let open = parseFloat(last) + parseFloat(change);
    return new Ticker({
      exchange: "Binance",
      base: market.base,
      quote: market.quote,
      timestamp: timestamp,
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

  _constructAggTrade({ data }, market) {
    let { a: trade_id, p: price, q: size, T: time, m: buyer } = data;
    let unix = time;
    let amount = size;
    let side = buyer ? "buy" : "sell";
    return new Trade({
      exchange: "Binance",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id.toFixed(),
      unix,
      side,
      price,
      amount,
    });
  }

  _constructRawTrade({ data }, market) {
    let { t: trade_id, p: price, q: size, b: buyOrderId, a: sellOrderId, T: time, m: buyer } = data;
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

  /**
   * Kline data looks like:
   { stream: 'btcusdt@kline_1m',
    data:
    { e: 'kline',
      E: 1571068845689,
      s: 'BTCUSDT',
      k:
        { t: 1571068800000,
          T: 1571068859999,
          s: 'BTCUSDT',
          i: '1m',
          f: 189927800,
          L: 189928107,
          o: '8254.05000000',
          c: '8253.61000000',
          h: '8256.58000000',
          l: '8250.93000000',
          v: '19.10571600',
          n: 308,
          x: false,
          q: '157694.32610840',
          V: '8.19456200',
          Q: '67640.56793106',
          B: '0' } } }
   */
  _constructCandle({ data }) {
    let k = data.k;
    return new Candle(k.t, k.o, k.h, k.l, k.c, k.v);
  }

  _constructLevel2Snapshot(msg, market) {
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

  _constructLevel2Update(msg, market) {
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
      let failed = false;
      try {
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
        this.emit("l2snapshot", snapshot, market);
      } catch (ex) {
        this.emit("error", ex);
        failed = true;
      } finally {
        await wait(this.REST_REQUEST_DELAY_MS);
        this._restSem.leave();
        if (failed) this._requestLevel2Snapshot(market);
      }
    });
  }

  _createMessageId() {
    this._messageId = this._messageId + 1;
    return this._messageId;
  }

  _buildStreams() {
    let streams = [].concat(
      Array.from(this._tradeSubs.keys()).map(p => p + (this.useAggTrades ? "@aggTrade" : "@trade")),
      Array.from(this._candleSubs.keys()).map(p => `${p}@kline_${candlePeriod(this.candlePeriod)}`),
      Array.from(this._level2SnapshotSubs.keys()).map(p => p + "@depth20"),
      Array.from(this._level2UpdateSubs.keys()).map(p => p + "@depth")
    );
    if (this._tickerSubs.size > 0) {
      streams.push("!ticker@arr");
    }

    return streams;
  }
}

module.exports = BinanceClient;
