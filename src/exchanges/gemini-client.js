const { EventEmitter } = require("events");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const SmartWss = require("../smart-wss");
const Ticker = require("../ticker");
class GeminiClient extends EventEmitter {
  constructor() {
    super();
    this._name = "Gemini";
    this._subscriptions = new Map();
    this.reconnectIntervalMs = 30 * 1000;
    this.tickersCache = new Map(); // key-value pairs of <market_id>: Ticker

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = false;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;
  }

  reconnect() {
    for (let subscription of this._subscriptions.values()) {
      this._reconnect(subscription);
    }
  }

  subscribeTrades(market) {
    this._subscribe(market, "trades");
  }

  unsubscribeTrades(market) {
    this._unsubscribe(market, "trades");
  }

  subscribeLevel2Updates(market) {
    this._subscribe(market, "level2updates");
  }

  unsubscribeLevel2Updates(market) {
    this._unsubscribe(market, "level2updates");
  }

  subscribeTicker(market) {
    this._subscribe(market, "tickers");
  }

  unsubscribeTicker(market) {
    this._unsubscribe(market, "tickers");
  }

  close() {
    this._close();
  }

  ////////////////////////////////////////////
  // PROTECTED

  _subscribe(market, mode) {
    let remote_id = market.id.toLowerCase();
    let subscription = this._subscriptions.get(remote_id);

    if (subscription && subscription[mode]) return;

    if (!subscription) {
      subscription = {
        market,
        wss: this._connect(remote_id, mode),
        lastMessage: undefined,
        reconnectIntervalHandle: undefined,
        remoteId: remote_id,
        trades: false,
        level2Updates: false,
        tickers: false,
        mode
      };

      this._startReconnectWatcher(subscription);
      this._subscriptions.set(remote_id, subscription);
    }

    subscription[mode] = true;
  }

  _unsubscribe(market, mode) {
    let remote_id = market.id.toLowerCase();
    let subscription = this._subscriptions.get(remote_id);

    if (!subscription) return;
    subscription[mode] = false;
    if (!subscription.trades && !subscription.level2updates) {
      this._close(this._subscriptions.get(remote_id));
      this._subscriptions.delete(remote_id);
    }
    if (mode === 'tickers') {
      this.tickersCache.delete(market.id);
    }
  }

  /** Connect to the websocket stream by constructing a path from
   * the subscribed markets.
   */
  _connect(remote_id, mode) {
    let wssPath = "wss://api.gemini.com/v1/marketdata/" + remote_id + "?heartbeat=true";
    if (mode === "tickers") {
      wssPath += '&top_of_book=true';
    }
    let wss = new SmartWss(wssPath);
    wss.on("error", err => this._onError(remote_id, err));
    wss.on("connecting", () => this._onConnecting(remote_id));
    wss.on("connected", () => this._onConnected(remote_id));
    wss.on("disconnected", () => this._onDisconnected(remote_id));
    wss.on("closing", () => this._onClosing(remote_id));
    wss.on("closed", () => this._onClosed(remote_id));
    wss.on("message", raw => {
      try {
        this._onMessage(remote_id, raw);
      } catch (err) {
        this._onError(remote_id, err);
      }
    });
    wss.connect();
    return wss;
  }

  /**
   * Handles an error
   */
  _onError(remote_id, err) {
    this.emit("error", err, remote_id);
  }

  /**
   * Fires when a socket is connecting
   */
  _onConnecting(remote_id) {
    this.emit("connecting", remote_id);
  }

  /**
   * Fires when connected
   */
  _onConnected(remote_id) {
    let subscription = this._subscriptions.get(remote_id);
    if (!subscription) {
      return;
    }
    this._startReconnectWatcher(subscription);
    this.emit("connected", remote_id);
  }

  /**
   * Fires when there is a disconnection event
   */
  _onDisconnected(remote_id) {
    this._stopReconnectWatcher(this._subscriptions.get(remote_id));
    this.emit("disconnected", remote_id);
  }

  /**
   * Fires when the underlying socket is closing
   */
  _onClosing(remote_id) {
    this._stopReconnectWatcher(this._subscriptions.get(remote_id));
    this.emit("closing", remote_id);
  }

  /**
   * Fires when the underlying socket has closed
   */
  _onClosed(remote_id) {
    this.emit("closed", remote_id);
  }

  /**
   * Close the underlying connction, which provides a way to reset the things
   */
  _close(subscription) {
    if (subscription && subscription.wss) {
      try {
        subscription.wss.close();
      } catch (ex) {
        if (ex.message === "WebSocket was closed before the connection was established") return;
        this.emit("error", ex);
      }
      subscription.wss = undefined;
      this._stopReconnectWatcher(subscription);
    } else {
      this._subscriptions.forEach(sub => this._close(sub));
      this._subscriptions = new Map();
    }
  }

  /**
   * Reconnects the socket
   */
  _reconnect(subscription) {
    this.emit("reconnecting", subscription.remoteId);
    subscription.wss.once("closed", () => {
      subscription.wss = this._connect(subscription.remoteId, subscription.mode);
    });
    this._close(subscription);
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
    if (subscription) {
      clearInterval(subscription.reconnectIntervalHandle);
      subscription.reconnectIntervalHandle = undefined;
    }
  }

  /**
   * Checks if a reconnecton is required by comparing the current
   * date to the last receieved message date
   */
  _onReconnectCheck(subscription) {
    if (
      !subscription.lastMessage ||
      subscription.lastMessage < Date.now() - this.reconnectIntervalMs
    ) {
      this._reconnect(subscription);
    }
  }

  ////////////////////////////////////////////
  // ABSTRACT

  _onMessage(remote_id, raw) {
    let msg = JSON.parse(raw);
    let subscription = this._subscriptions.get(remote_id);
    let market = subscription.market;
    subscription.lastMessage = Date.now();

    if (!market) return;

    if (msg.type === "update") {
      let { timestampms, eventId, socket_sequence } = msg;

      // process trades
      if (subscription.trades) {
        let events = msg.events.filter(p => p.type === "trade" && /ask|bid/.test(p.makerSide));
        for (let event of events) {
          let trade = this._constructTrade(event, market, timestampms);
          this.emit("trade", trade, market);
        }
        return;
      }

      // process l2 updates
      if (subscription.level2updates) {
        let updates = msg.events.filter(p => p.type === "change");
        if (socket_sequence === 0) {
          let snapshot = this._constructL2Snapshot(updates, market, eventId);
          this.emit("l2snapshot", snapshot, market);
        } else {
          let update = this._constructL2Update(updates, market, eventId, timestampms);
          this.emit("l2update", update, market);
        }
        return;
      }
      if (subscription.tickers) {
        const marketId = subscription.market.id;
        if (!this.tickersCache.has(marketId)) {
          this.tickersCache.set(marketId, new Ticker({ 
            base: subscription.market.base,
            quote: subscription.market.quote
          }));
        }
        const thisCachedTicker = this.tickersCache.get(marketId);
        msg.events.forEach(thisEvt => {
          if (thisEvt.type === 'change' && thisEvt.side === 'ask') {
            thisCachedTicker.ask = thisEvt.price;
            thisCachedTicker.timestamp = thisEvt.timestamp;
          }
          if (thisEvt.type === 'change' && thisEvt.side === 'bid') {
            thisCachedTicker.bid = thisEvt.price;
            thisCachedTicker.timestamp = thisEvt.timestamp;
          }
          if (thisEvt.type === 'trade') {
            thisCachedTicker.last = thisEvt.price;
            thisCachedTicker.timestamp = thisEvt.timestamp;
          }
        });
        this.emit("ticker", this.tickersCache.get(marketId), market);
      } 
    }
  }

  _constructTrade(event, market, timestamp) {
    let side = event.makerSide === "ask" ? "sell" : "buy";
    let price = event.price;
    let amount = event.amount;

    return new Trade({
      exchange: "Gemini",
      base: market.base,
      quote: market.quote,
      tradeId: event.tid.toFixed(),
      side,
      unix: timestamp,
      price,
      amount,
    });
  }

  _constructL2Snapshot(events, market, sequenceId) {
    let asks = [];
    let bids = [];

    for (let { side, price, remaining, reason, delta } of events) {
      let update = new Level2Point(price, remaining, undefined, { reason, delta });
      if (side === "ask") asks.push(update);
      else bids.push(update);
    }

    return new Level2Snapshot({
      exchange: "Gemini",
      base: market.base,
      quote: market.quote,
      sequenceId,
      asks,
      bids,
    });
  }

  _constructL2Update(events, market, sequenceId, timestampMs) {
    let asks = [];
    let bids = [];

    for (let { side, price, remaining, reason, delta } of events) {
      let update = new Level2Point(price, remaining, undefined, { reason, delta });
      if (side === "ask") asks.push(update);
      else bids.push(update);
    }

    return new Level2Update({
      exchange: "Gemini",
      base: market.base,
      quote: market.quote,
      sequenceId,
      timestampMs,
      asks,
      bids,
    });
  }
}

module.exports = GeminiClient;
