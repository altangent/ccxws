const { EventEmitter } = require("events");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const SmartWss = require("../smart-wss");
const winston = require("winston");

class GeminiClient extends EventEmitter {
  constructor() {
    super();
    this._name = "Gemini";
    this._subscriptions = new Map();
    this.reconnectIntervalMs = 30 * 1000;

    this.hasTrades = true;
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

  close() {
    this._close();
  }

  ////////////////////////////////////////////
  // PROTECTED

  _subscribe(market, mode) {
    let remote_id = market.id.toLowerCase();
    let subscription = this._subscriptions.get(remote_id);

    if (subscription && subscription[mode]) return;

    winston.info("subscribing to " + mode, this._name, remote_id);

    if (!subscription) {
      subscription = {
        market,
        wss: this._connect(remote_id),
        lastMessage: undefined,
        reconnectIntervalHandle: undefined,
        remoteId: remote_id,
        trades: false,
        level2Updates: false,
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

    winston.info("unsubscribing from " + mode, this._name, remote_id);

    subscription[mode] = false;
    if (!subscription.trades && !subscription.level2updates) {
      this._close(this._subscriptions.get(remote_id));
      this._subscriptions.delete(remote_id);
    }
  }

  /** Connect to the websocket stream by constructing a path from
   * the subscribed markets.
   */
  _connect(remote_id) {
    let wssPath = "wss://api.gemini.com/v1/marketdata/" + remote_id + "?heartbeat=true";
    let wss = new SmartWss(wssPath);
    wss.on("open", () => this._onConnected(remote_id));
    wss.on("message", raw => this._onMessage(remote_id, raw));
    wss.on("disconnected", () => this._onDisconnected(remote_id));
    wss.connect();
    return wss;
  }

  /**
   * Fires when connected
   */
  _onConnected(remote_id) {
    let subscription = this._subscriptions.get(remote_id);
    if (!subscription) {
      winston.warn(`${remote_id} is not subscribed`);
      return;
    }
    this._startReconnectWatcher(subscription);
  }

  /**
   * Fires when there is a disconnection event
   */
  _onDisconnected(remote_id) {
    this._stopReconnectWatcher(this._subscriptions.get(remote_id));
    this.emit("disconnected", remote_id);
  }

  /**
   * Close the underlying connction, which provides a way to reset the things
   */
  _close(subscription) {
    if (subscription && subscription.wss) {
      subscription.wss.close();
      subscription.wss = undefined;
      this._stopReconnectWatcher(subscription);
    } else {
      this._subscriptions.forEach(sub => {
        this._stopReconnectWatcher(sub);
        sub.wss.close();
      });
      this.emit("closed");
      this._subscriptions = new Map();
    }
  }

  /**
   * Reconnects the socket
   */
  _reconnect(subscription) {
    this._close(subscription);
    subscription.wss = this._connect(subscription.remoteId);
    this.emit("reconnected", subscription.remoteId);
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
      tradeId: event.tid,
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
