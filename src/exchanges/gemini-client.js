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
    this.reconnectIntervalMs = 90000;
  }

  subscribeTrades(market) {
    let remoteId = market.id.toLowerCase();
    if (!this._subscriptions.has(remoteId)) {
      winston.info("subscribing to", this._name, remoteId);

      let subscription = {
        market,
        wss: this._connect(remoteId),
        lastMessage: undefined,
        reconnectIntervalHandle: undefined,
        remoteId: remoteId,
      };

      this._startReconnectWatcher(subscription);
      this._subscriptions.set(remoteId, subscription);
    }
  }

  unsubscribeTrades(market) {
    let remoteId = market.id.toLowerCase();
    if (this._subscriptions.has(remoteId)) {
      winston.info("unsubscribing from", this._name, remoteId);
      this._close(this._subscriptions.get(remoteId));
      this._subscriptions.delete(remoteId);
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
  _close(subscription) {
    if (subscription && subscription.wss) {
      subscription.wss.close();
      subscription.wss = undefined;
      this._stopReconnectWatcher(subscription);
      this.emit("closed", subscription.remoteId);
    } else {
      this._subscriptions.forEach(sub => {
        this._stopReconnectWatcher(sub);
        sub.wss.close();
        this.emit("closed", sub.remoteId);
      });
      this._subscriptions = new Map();
    }
  }

  /** Connect to the websocket stream by constructing a path from
   * the subscribed markets.
   */
  _connect(stream) {
    let wssPath = "wss://api.gemini.com/v1/marketdata/" + stream;
    let wss = new SmartWss(wssPath);
    wss.on("message", raw => this._onMessage(stream, raw));
    wss.on("disconnected", () => {
      this._stopReconnectWatcher(this._subscriptions.get(stream));
      this.emit("disconnected", stream);
    });
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

  /**
   * Starts an interval to check if a reconnction is required
   */
  _startReconnectWatcher(subscription) {
    this._stopReconnectWatcher(subscription); // always clear the prior interval
    subscription.reconnectIntervalHandle = setInterval(
      () => this._onReconnectCheck(subscription),
      this.reconnectIntervalMs
    );
  }

  /**
   * Stops an interval to check if a reconnection is required
   */
  _stopReconnectWatcher(subscription) {
    clearInterval(subscription.reconnectIntervalHandle);
    subscription.reconnectIntervalHandle = undefined;
  }

  /**
   * Checks if a reconnecton is required by comparing the current
   * date to the last receieved message date
   */
  _onReconnectCheck(subscription) {
    if (subscription.lastMessage < Date.now() - this.reconnectIntervalMs) {
      this._reconnect(subscription);
    }
  }

  /**
   * Reconnects the socket
   */
  _reconnect(subscription) {
    this._close(subscription.wss);
    subscription.wss = this._connect(subscription.remoteId);
    this.emit("reconnected", subscription.remoteId);
  }

  ////////////////////////////////////////////
  // ABSTRACT

  _onMessage(stream, raw) {
    let msg = JSON.parse(raw);
    let subscription = this._subscriptions.get(stream);
    subscription.lastMessage = msg.timestampms;
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
