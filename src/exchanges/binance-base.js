const { CandlePeriod } = require("../enums");
const https = require("../https");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Candle = require("../candle");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const BasicClient = require("../basic-client");
const { throttle } = require("../flowcontrol/throttle");
const { batch } = require("../flowcontrol/batch");

/**
 * Binance now (as of Nov 2019) has the ability to perform live subscribes using
 * a single socket. With this functionality, there is no longer a need to
 * use the URL-mutation code and we can use a BasicClient and allow subscribing
 * and unsubscribing.
 *
 * Binance allows subscribing to many streams at the same time, however there is
 * a max payload length that cannot be exceeded. This requires the use of a
 * subscription batching method.
 *
 * Binance limits the number of messages that can be sent as well so throttling
 * of batched sends must be performed.
 *
 * _sendSubTrades calls _batchSub
 * _batchSub uses the `batch` flow control helper to batch all calls on the
 *    same tick into a single call
 * _batchSub calls _sendMessage
 * _sendMessage uses the `throttle` flow controler helper to limit calls to
 *    1 per second
 *
 */
class BinanceBase extends BasicClient {
  constructor({
    name,
    wssPath,
    restL2SnapshotPath,
    watcherMs = 30000,
    useAggTrades = true,
    requestSnapshot = true,
    socketBatchSize = 200,
    socketThrottleMs = 1000,
    restThrottleMs = 1000,
    l2updateSpeed = "",
    l2snapshotSpeed = "",
  } = {}) {
    super(wssPath, name, undefined, watcherMs);
    this._restL2SnapshotPath = restL2SnapshotPath;

    this.useAggTrades = useAggTrades;
    this.l2updateSpeed = l2updateSpeed;
    this.l2snapshotSpeed = l2snapshotSpeed;
    this.requestSnapshot = requestSnapshot;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;

    this._messageId = 0;
    this._tickersActive = false;
    this.candlePeriod = CandlePeriod._1m;

    this._batchSub = batch(this._batchSub.bind(this), socketBatchSize);
    this._batchUnsub = batch(this._batchUnsub.bind(this), socketBatchSize);

    this._sendMessage = throttle(this._sendMessage.bind(this), socketThrottleMs);
    this._requestLevel2Snapshot = throttle(this._requestLevel2Snapshot.bind(this), restThrottleMs);
  }

  //////////////////////////////////////////////

  _onClosing() {
    this._tickersActive = false;
    this._batchSub.cancel();
    this._batchUnsub.cancel();
    this._sendMessage.cancel();
    this._requestLevel2Snapshot.cancel();
    super._onClosing();
  }

  _sendSubTicker() {
    if (this._tickersActive) return;
    this._tickersActive = true;
    this._wss.send(
      JSON.stringify({
        method: "SUBSCRIBE",
        params: ["!ticker@arr"],
        id: ++this._messageId,
      })
    );
  }

  _sendUnsubTicker() {
    if (this._tickerSubs.size > 1) return;
    this._tickersActive = false;
    this._wss.send(
      JSON.stringify({
        method: "UNSUBSCRIBE",
        params: ["!ticker@arr"],
        id: ++this._messageId,
      })
    );
  }

  _batchSub(args) {
    const params = args.map(p => p[0]);
    const id = ++this._messageId;
    const msg = JSON.stringify({
      method: "SUBSCRIBE",
      params,
      id,
    });
    this._sendMessage(msg);
  }

  _batchUnsub(args) {
    const params = args.map(p => p[0]);
    const id = ++this._messageId;
    const msg = JSON.stringify({
      method: "UNSUBSCRIBE",
      params,
      id,
    });
    this._sendMessage(msg);
  }

  _sendMessage(msg) {
    this._wss.send(msg);
  }

  _sendSubTrades(remote_id) {
    const stream = remote_id.toLowerCase() + (this.useAggTrades ? "@aggTrade" : "@trade");
    this._batchSub(stream);
  }

  _sendUnsubTrades(remote_id) {
    const stream = remote_id.toLowerCase() + (this.useAggTrades ? "@aggTrade" : "@trade");
    this._batchUnsub(stream);
  }

  _sendSubCandles(remote_id) {
    const stream = remote_id.toLowerCase() + "@kline_" + candlePeriod(this.candlePeriod);
    this._batchSub(stream);
  }

  _sendUnsubCandles(remote_id) {
    const stream = remote_id.toLowerCase() + "@kline_" + candlePeriod(this.candlePeriod);
    this._batchUnsub(stream);
  }

  _sendSubLevel2Snapshots(remote_id) {
    const stream =
      remote_id.toLowerCase() +
      "@depth20" +
      (this.l2snapshotSpeed ? `@${this.l2snapshotSpeed}` : "");
    this._batchSub(stream);
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    const stream =
      remote_id.toLowerCase() +
      "@depth20" +
      (this.l2snapshotSpeed ? `@${this.l2snapshotSpeed}` : "");
    this._batchUnsub(stream);
  }

  _sendSubLevel2Updates(remote_id) {
    if (this.requestSnapshot) this._requestLevel2Snapshot(this._level2UpdateSubs.get(remote_id));
    const stream =
      remote_id.toLowerCase() + "@depth" + (this.l2updateSpeed ? `@${this.l2updateSpeed}` : "");
    this._batchSub(stream);
  }

  _sendUnsubLevel2Updates(remote_id) {
    const stream =
      remote_id.toLowerCase() + "@depth" + (this.l2updateSpeed ? `@${this.l2updateSpeed}` : "");
    this._batchUnsub(stream);
  }

  /////////////////////////////////////////////

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    // subscribe/unsubscribe responses
    if (msg.result === null && msg.id) {
      // console.log(msg);
      return;
    }

    // errors
    if (msg.error) {
      const error = new Error(msg.error.msg);
      error.msg = msg;
      this.emit("error", error);
    }

    // All code past this point relies on msg.stream in some manner. This code
    // acts as a guard on msg.stream and aborts prematurely if the property is
    // not available.
    if (!msg.stream) {
      return;
    }

    // ticker
    if (msg.stream === "!ticker@arr") {
      for (let raw of msg.data) {
        let remote_id = raw.s;
        let market = this._tickerSubs.get(remote_id);
        if (!market) continue;

        let ticker = this._constructTicker(raw, market);
        this.emit("ticker", ticker, market);
      }
      return;
    }

    // trades
    if (msg.stream.toLowerCase().endsWith("trade")) {
      let remote_id = msg.data.s;
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
      let remote_id = msg.data.s;
      let market = this._candleSubs.get(remote_id);
      if (!market) return;

      let candle = this._constructCandle(msg, market);
      this.emit("candle", candle, market);
      return;
    }

    // l2snapshot
    if (msg.stream.match(/@depth20/)) {
      let remote_id = msg.stream.split("@")[0].toUpperCase();
      let market = this._level2SnapshotSubs.get(remote_id);
      if (!market) return;

      let snapshot = this._constructLevel2Snapshot(msg, market);
      this.emit("l2snapshot", snapshot, market);
      return;
    }

    // l2update
    if (msg.stream.match(/@depth/)) {
      let remote_id = msg.stream.split("@")[0].toUpperCase();
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
      exchange: this._name,
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
      exchange: this._name,
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
      exchange: this._name,
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
      exchange: this._name,
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
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId,
      lastSequenceId,
      asks,
      bids,
    });
  }

  async _requestLevel2Snapshot(market) {
    let failed = false;
    try {
      let remote_id = market.id;
      let uri = `${this._restL2SnapshotPath}?limit=1000&symbol=${remote_id}`;
      let raw = await https.get(uri);
      let sequenceId = raw.lastUpdateId;
      let asks = raw.asks.map(p => new Level2Point(p[0], p[1]));
      let bids = raw.bids.map(p => new Level2Point(p[0], p[1]));
      let snapshot = new Level2Snapshot({
        exchange: this._name,
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
      if (failed) this._requestLevel2Snapshot(market);
    }
  }
}

function candlePeriod(p) {
  switch (p) {
    case CandlePeriod._1m:
      return "1m";
    case CandlePeriod._3m:
      return "3m";
    case CandlePeriod._5m:
      return "5m";
    case CandlePeriod._15m:
      return "15m";
    case CandlePeriod._30m:
      return "30m";
    case CandlePeriod._1h:
      return "1h";
    case CandlePeriod._2h:
      return "2h";
    case CandlePeriod._4h:
      return "4h";
    case CandlePeriod._6h:
      return "6h";
    case CandlePeriod._8h:
      return "8h";
    case CandlePeriod._12h:
      return "12h";
    case CandlePeriod._1d:
      return "1d";
    case CandlePeriod._3d:
      return "3d";
    case CandlePeriod._1w:
      return "1w";
    case CandlePeriod._1M:
      return "1M";
  }
}

module.exports = {
  candlePeriod,
  BinanceBase,
};
