const { EventEmitter } = require("events");
const winston = require("winston");
const moment = require("moment");
const bittrex = require("node-bittrex-api");
const Trade = require("../trade");

class BittrexClient extends EventEmitter {
  constructor() {
    super();
    this._subscribed = new Map();
    this._surrogateId = Date.now();
  }

  _newSurrogateId() {
    this._surrogateId++;
    return this._surrogateId;
  }

  subscribeTrades(market) {
    let remote_id = market.id;
    if (!this._subscribed.has(remote_id)) {
      winston.info("subscribing to", "Bittrex", remote_id);
      this._subscribed.set(remote_id, market);
      this._debounceReconnect();
    }
  }

  unsubscribeTrades(market) {
    let remote_id = market.id;
    if (this._subscribed.has(remote_id)) {
      winston.info("unsubscribing from", "Bittrex", remote_id);
      this._subscribed.delete(remote_id);
      this._debounceReconnect();
    }
  }

  _debounceReconnect() {
    clearTimeout(this._reconnectTimeout);
    this._reconnectTimeout = setTimeout(() => {
      // if connection exists, close to trigger reconnect with new pairs
      if (this._client) this._client.end();
      else {
        bittrex.options({
          verbose: false,
          websockets: {
            onConnect: () => {
              let pairs = Array.from(this._subscribed.keys());
              if (pairs.length) {
                bittrex.websockets.subscribe(pairs, data => {
                  this._onMessage(data);
                });
              }
            },
          },
        });
        this._connect();
      }
    }, 100);
  }

  _connect() {
    bittrex.websockets.client(client => {
      this._client = client;
      client.serviceHandlers.connectFailed = err => winston.error("Bittrex", err.message);
      client.serviceHandlers.onerror = err => winston.error("Bittrex", err.message);
    });
  }

  _onMessage(raw) {
    if (raw.M === "updateExchangeState") {
      raw.A.forEach(data => {
        data.Fills.forEach(fill => {
          let trade = this._constructTradeFromMessage(fill, data.MarketName);
          this.emit("trade", trade);
        });
      });
    }
  }

  _constructTradeFromMessage(msg, marketName) {
    let market = this._subscribed.get(marketName);
    let trade_id = this._newSurrogateId();
    let unix = moment.utc(msg.TimeStamp).unix();
    let price = parseFloat(msg.Rate);
    let amount = msg.OrderType === "BUY" ? parseFloat(msg.Quantity) : -parseFloat(msg.Quantity);

    return new Trade({
      exchange: "Bittrex",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id,
      unix,
      price,
      amount,
    });
  }
}

module.exports = BittrexClient;
