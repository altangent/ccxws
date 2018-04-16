const { EventEmitter } = require("events");
const moment = require("moment");
const winston = require("winston");
const Trade = require("../trade");
const SmartWss = require("../smart-wss");

class BinanceClient extends EventEmitter {
  constructor() {
    super();
    this._name = "Binance";
    this._subscriptions = new Map();
    this._wss = undefined;
    this._reconnectDebounce = undefined;
  }

  //////////////////////////////////////////////

  subscribeTrades(market) {
    let remote_id = market.id.toLowerCase();
    if (!this._subscriptions.has(remote_id)) {
      winston.info("subscribing to", this._name, remote_id);
      this._subscriptions.set(remote_id, market);
      this._reconnect();
    }
  }

  unsubscribeTrades(market) {
    let remote_id = market.id.toLowerCase();
    if (this._subscriptions.has(remote_id)) {
      winston.info("unsubscribing from", this._name, remote_id);
      this._subscriptions.delete(market);
      this._reconnect();
    }
  }

  close() {
    this._close();
  }

  ////////////////////////////////////////////
  // PROTECTED

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
      let streams = Array.from(this._subscriptions.keys())
        .map(p => p + "@aggTrade")
        .join("/");
      let wssPath = "wss://stream.binance.com:9443/stream?streams=" + streams;

      this._wss = new SmartWss(wssPath);
      this._wss.on("message", this._onMessage.bind(this));
      this._wss.connect();
    }
  }

  ////////////////////////////////////////////
  // ABSTRACT

  _onMessage(raw) {
    let msg = JSON.parse(raw);
    let trade = this._constructTradeFromMessage(msg);
    this.emit("trade", trade);
  }

  _constructTradeFromMessage({ data }) {
    let { s: symbol, p: price, q: size, f: trade_id, T: time, m: buyer } = data;

    let market = this._subscriptions.get(symbol.toLowerCase());

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
}

module.exports = BinanceClient;
