const { EventEmitter } = require("events");
const Trade = require("../trade");
const Auction = require("../auction");
const SmartWss = require("../smart-wss");
const winston = require("winston");

class GeminiClient extends EventEmitter {
  constructor() {
    super();
    this._name = "Gemini";
    this._subscriptions = new Map();
    this._reconnectDebounce = undefined;
  }

  //////////////////////////////////////////////

  subscribeTrades(market) {
    let remote_id = market.id;
    if (!this._subscriptions.has(remote_id)) {
      winston.info("subscribing to", this._name, remote_id);
      this._subscriptions.set(remote_id, {
        market,
        wss: this._connect(remote_id),
      });
    }
  }

  unsubscribeTrades(market) {
    let remote_id = market.id.toLowerCase();
    if (this._subscriptions.has(remote_id)) {
      winston.info("unsubscribing from", this._name, remote_id);
      this._close(this._subscriptions.get(remote_id).wss);
      this._subscriptions.delete(remote_id);
    }
  }

  close() {
    this._close();
  }

  ////////////////////////////////////////////
  // PROTECTED

  /**
   * Close the underlying connction, which provides a way to reset the things
   */
  _close(wss) {
    if (wss) {
      wss.close();
      wss = undefined;
      this.emit("closed");
    } else {
      this._subscriptions.forEach(sub => {
        sub.wss.close();
      });
      this._subscriptions = new Map();
      this.emit("closed");
    }
  }

  /** Connect to the websocket stream by constructing a path from
   * the subscribed markets.
   */
  _connect(stream) {
    let wssPath = "wss://api.gemini.com/v1/marketdata/" + stream;

    let wss = new SmartWss(wssPath);
    wss.on("message", raw => {
      this._onMessage.bind(this)(stream, raw);
    });
    wss.on("disconnected", () => this.emit("disconnected"));
    wss.connect();
    return wss;
  }

  _formatTrade(event, market, timestamp) {
    let price = parseFloat(event.price);
    let amount = event.makerSide === "ask" ? parseFloat(event.amount) : -parseFloat(event.amount);

    return new Trade({
      exchange: "Gemini",
      base: market.base,
      quote: market.quote,
      tradeId: event.tid,
      price,
      amount,
      unix: timestamp,
    });
  }

  _formatAuction(data, market) {
    let trade = data.events[0];
    let auctionResults = data.events[1];
    let price = parseFloat(trade.price);

    return new Auction({
      exchange: "Gemini",
      base: market.base,
      quote: market.quote,
      tradeId: trade.tid,
      price,
      amount: trade.amount,
      unix: data.timestamp,
      high: auctionResults.highest_bid_price,
      low: auctionResults.lowest_ask_price,
    });
  }

  ////////////////////////////////////////////
  // ABSTRACT

  _onMessage(stream, raw) {
    let msg = JSON.parse(raw);
    let trades = this._constructTradeFromMessage(msg, stream);
    trades.map(trade => this.emit(trade.constructor.name.toLowerCase(), trade));
  }

  _constructTradeFromMessage(data, stream) {
    if (data.type !== "update") return;
    let tradeTransformer = event => {
      if (event.type !== "trade") return undefined;
      let market = this._subscriptions.get(stream).market;

      if (event.makerSide === "auction") return this._formatAuction(data, market);
      return this._formatTrade(event, market, data.timestamp);
    };

    let trades = data.events.map(tradeTransformer).filter(x => x !== undefined);
    return trades;
  }
}

module.exports = GeminiClient;
