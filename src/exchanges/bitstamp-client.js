const { EventEmitter } = require("events");
const winston = require("winston");
const Pusher = require("pusher-js");
const Trade = require("../trade");

class BitstampClient extends EventEmitter {
  constructor() {
    super();
    this._name = "Bitstamp";
    this._subscriptions = new Map();
  }

  subscribeTrades(market) {
    this._connect();
    let remote_id = market.id;
    if (!this._subscriptions.has(remote_id)) {
      winston.info("subscribing to", this._name, remote_id);
      this._subscriptions.set(remote_id, market);
      this._sendSubscribe(remote_id);
    }
  }

  unsubscribeTrades(market) {
    let remote_id = market.id;
    if (this._subscriptions.has(remote_id)) {
      winston.info("unsubscribing from", this._name, remote_id);
      this._subscriptions.delete(remote_id);
      this._sendUnsubscribe(remote_id);
    }
  }

  close() {
    if (this._pusher) {
      this._pusher.disconnect();
      this._pusher = undefined;
    }
    this.emit("closed");
  }

  //////////////////////////////

  _connect() {
    if (!this._pusher) {
      this._pusher = new Pusher("de504dc5763aeef9ff52");
    }
  }

  _onMessage(remote_id, msg) {
    let market = this._subscriptions.get(remote_id);

    /* trade message format:

    { amount: 0.363,
      buy_order_id: 1347930302,
      sell_order_id: 1347930276,
      amount_str: '0.36300000',
      price_str: '8094.97',
      timestamp: '1524058372',
      price: 8094.97,
      type: 0,
      id: 62696598 }

    */

    let trade = new Trade({
      exchange: "Bitstamp",
      base: market.base,
      quote: market.quote,
      tradeId: msg.id,
      unix: parseInt(msg.timestamp),
      price: msg.price,
      amount: msg.type === 1 ? -msg.amount : msg.amount,
    });
    this.emit("trade", trade);
  }

  _sendSubscribe(remote_id) {
    let channelName = this._channelName(remote_id);
    let channel = this._pusher.subscribe(channelName);
    channel.bind("trade", this._onMessage.bind(this, remote_id));
  }

  _sendUnsubscribe(remote_id) {
    let channelName = this._channelName(remote_id);
    this._pusher.unsubscribe(channelName);
  }

  _channelName(market) {
    return market === "btcusd" ? "live_trades" : `live_trades_${market}`;
  }
}

module.exports = BitstampClient;
