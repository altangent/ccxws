const { EventEmitter } = require("events");
const moment = require("moment");
const winston = require("winston");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const SmartWss = require("../smart-wss");

class BinanceClient extends EventEmitter {
  constructor() {
    super();
    this._name = "Binance";
    this._tradeSubs = new Map();
    this._level2SnapshotSubs = new Map();
    this._level2UpdateSubs = new Map();
    this._wss = undefined;
    this._reconnectDebounce = undefined;

    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;
  }

  //////////////////////////////////////////////

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
        Array.from(this._tradeSubs.keys()).map(p => p + "@aggTrade"),
        Array.from(this._level2SnapshotSubs.keys()).map(p => p + "@depth20"),
        Array.from(this._level2UpdateSubs.keys()).map(p => p + "@depth")
      );

      let wssPath = "wss://stream.binance.com:9443/stream?streams=" + streams.join("/");

      this._wss = new SmartWss(wssPath);
      this._wss.on("message", this._onMessage.bind(this));
      this._wss.on("disconnected", () => this.emit("disconnected"));
      this._wss.connect();
    }
  }

  ////////////////////////////////////////////
  // ABSTRACT

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    // trades
    if (msg.stream.endsWith("aggTrade")) {
      let trade = this._constructTradeFromMessage(msg);
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

  _constructTradeFromMessage({ data }) {
    let { s: symbol, p: price, q: size, f: trade_id, T: time, m: buyer } = data;

    let market = this._tradeSubs.get(symbol.toLowerCase());

    let unix = moment.utc(time).unix();
    let amount = buyer ? parseFloat(size) : -parseFloat(size);
    price = parseFloat(price);

    return new Trade({
      exchange: "Binance",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id,
      unix,
      price,
      amount,
    });
  }

  _constructLevel2Snapshot(msg) {
    let remote_id = msg.stream.split("@")[0];
    let market = this._level2SnapshotSubs.get(remote_id);
    let sequenceId = msg.data.lastUpdateId;
    let asks = msg.data.asks.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.data.bids.map(p => new Level2Point(p[0], p[1]));
    return new Level2Update({
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
    return new Level2Snapshot({
      exchange: "Binance",
      base: market.base,
      quote: market.quote,
      sequenceId,
      lastSequenceId,
      asks,
      bids,
    });
  }
}

module.exports = BinanceClient;
