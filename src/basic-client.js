const { EventEmitter } = require("events");
const SmartWss = require("./smart-wss");
const Watcher = require("./watcher");

/**
 * Single websocket connection client with
 * subscribe and unsubscribe methods. It is also an EventEmitter
 * and broadcasts 'trade' events.
 *
 * Anytime the WSS client connects (such as a reconnect)
 * it run the _onConnected method and will resubscribe.
 */
class BasicTradeClient extends EventEmitter {
  constructor(wssPath, name, wssFactory, watcherMs) {
    super();
    this._wssPath = wssPath;
    this._name = name;
    this._tickerSubs = new Map();
    this._bookTickerSubs = new Map();
    this._allBookTickerSubs = new Map();
    this._tradeSubs = new Map();
    this._candleSubs = new Map();
    this._level2SnapshotSubs = new Map();
    this._level2UpdateSubs = new Map();
    this._level3UpdateSubs = new Map();
    this._wss = undefined;
    this._watcher = new Watcher(this, watcherMs);

    this.hasTickers = false;
    this.hasBookTicker = false;
    this.hasAllBookTicker = false;
    this.hasTrades = true;
    this.hasCandles = false;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = false;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;
    this._wssFactory = wssFactory || (path => new SmartWss(path));
  }

  //////////////////////////////////////////////

  close() {
    if (this._beforeClose) {
      this._beforeClose();
    }
    this._watcher.stop();
    if (this._wss) {
      this._wss.close();
      this._wss = undefined;
    }
  }

  reconnect() {
    this.emit("reconnecting");
    if (this._wss) {
      this._wss.once("closed", () => this._connect());
      this.close();
    } else {
      this._connect();
    }
  }

  subscribeTicker(market) {
    if (!this.hasTickers) return;
    return this._subscribe(market, this._tickerSubs, this._sendSubTicker.bind(this));
  }

  unsubscribeTicker(market) {
    if (!this.hasTickers) return;
    this._unsubscribe(market, this._tickerSubs, this._sendUnsubTicker.bind(this));
  }

  subscribeBookTicker(market) {
    if (!this.hasBookTicker) return;
    return this._subscribe(market, this._bookTickerSubs, this._sendSubBookTicker.bind(this));
  }

  unsubscribeBookTicker(market) {
    if (!this.hasBookTicker) return;
    this._unsubscribe(market, this._bookTickerSubs, this._sendUnsubBookTicker.bind(this));
  }

  subscribeAllBookTicker(market) {
    if (!this.hasAllBookTicker) return;
    return this._subscribe(market, this._allBookTickerSubs, this._sendSubAllBookTicker.bind(this));
  }

  unsubscribeAllBookTicker(market) {
    if (!this.hasAllBookTicker) return;
    return this._unsubscribe(market, this._allBookTickerSubs, this._sendUnsubAllBookTicker.bind(this));
  }

  subscribeCandles(market) {
    if (!this.hasCandles) return;
    return this._subscribe(market, this._candleSubs, this._sendSubCandles.bind(this));
  }

  unsubscribeCandles(market) {
    if (!this.hasCandles) return;
    this._unsubscribe(market, this._candleSubs, this._sendUnsubCandles.bind(this));
  }

  subscribeTrades(market) {
    if (!this.hasTrades) return;
    return this._subscribe(market, this._tradeSubs, this._sendSubTrades.bind(this));
  }

  unsubscribeTrades(market) {
    if (!this.hasTrades) return;
    this._unsubscribe(market, this._tradeSubs, this._sendUnsubTrades.bind(this));
  }

  subscribeLevel2Snapshots(market) {
    if (!this.hasLevel2Snapshots) return;
    return this._subscribe(
      market,
      this._level2SnapshotSubs,
      this._sendSubLevel2Snapshots.bind(this)
    );
  }

  unsubscribeLevel2Snapshots(market) {
    if (!this.hasLevel2Snapshots) return;
    this._unsubscribe(market, this._level2SnapshotSubs, this._sendUnsubLevel2Snapshots.bind(this));
  }

  subscribeLevel2Updates(market) {
    if (!this.hasLevel2Updates) return;
    return this._subscribe(market, this._level2UpdateSubs, this._sendSubLevel2Updates.bind(this));
  }

  unsubscribeLevel2Updates(market) {
    if (!this.hasLevel2Updates) return;
    this._unsubscribe(market, this._level2UpdateSubs, this._sendUnsubLevel2Updates.bind(this));
  }

  subscribeLevel3Updates(market) {
    if (!this.hasLevel3Updates) return;
    return this._subscribe(market, this._level3UpdateSubs, this._sendSubLevel3Updates.bind(this));
  }

  unsubscribeLevel3Updates(market) {
    if (!this.hasLevel3Updates) return;
    this._unsubscribe(market, this._level3UpdateSubs, this._sendUnsubLevel3Updates.bind(this));
  }

  ////////////////////////////////////////////
  // PROTECTED

  /**
   * Helper function for performing a subscription operation
   * where a subscription map is maintained and the message
   * send operation is performed
   * @param {Market} market
   * @param {Map}} map
   * @param {String} msg
   * @param {Function} sendFn
   * @returns {Boolean} returns true when a new subscription event occurs
   */
  _subscribe(market, map, sendFn) {
    this._connect();
    let remote_id = market.id;
    if (!map.has(remote_id)) {
      map.set(remote_id, market);

      // perform the subscription if we're connected
      // and if not, then we'll reply on the _onConnected event
      // to send the signal to our server!
      if (this._wss && this._wss.isConnected) {
        sendFn(remote_id, market);
      }
      return true;
    }
    return false;
  }

  /**
   * Helper function for performing an unsubscription operation
   * where a subscription map is maintained and the message
   * send operation is performed
   * @param {Market} market
   * @param {Map}} map
   * @param {String} msg
   * @param {Function} sendFn
   */
  _unsubscribe(market, map, sendFn) {
    let remote_id = market.id;
    if (map.has(remote_id)) {
      map.delete(remote_id);

      if (this._wss.isConnected) {
        sendFn(remote_id, market);
      }
    }
  }

  /**
   * Idempotent method for creating and initializing
   * a long standing web socket client. This method
   * is only called in the subscribe method. Multiple calls
   * have no effect.
   */
  _connect() {
    if (!this._wss) {
      this._wss = this._wssFactory(this._wssPath);
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
      if (this._beforeConnect) this._beforeConnect();
      this._wss.connect();
    }
  }

  /**
   * Handles the error event
   * @param {Error} err
   */
  _onError(err) {
    this.emit("error", err);
  }

  /**
   * Handles the connecting event. This is fired any time the
   * underlying websocket begins a connection.
   */
  _onConnecting() {
    this.emit("connecting");
  }

  /**
   * This method is fired anytime the socket is opened, whether
   * the first time, or any subsequent reconnects. This allows
   * the socket to immediate trigger resubscription to relevent
   * feeds
   */
  _onConnected() {
    this.emit("connected");
    for (let [marketSymbol, market] of this._tickerSubs) {
      this._sendSubTicker(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._bookTickerSubs) {
      this._sendSubBookTicker(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._allBookTickerSubs) {
      this._sendSubAllBookTicker(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._candleSubs) {
      this._sendSubCandles(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._tradeSubs) {
      this._sendSubTrades(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._level2SnapshotSubs) {
      this._sendSubLevel2Snapshots(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._level2UpdateSubs) {
      this._sendSubLevel2Updates(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._level3UpdateSubs) {
      this._sendSubLevel3Updates(marketSymbol, market);
    }
    this._watcher.start();
  }

  /**
   * Handles a disconnection event
   */
  _onDisconnected() {
    this._watcher.stop();
    this.emit("disconnected");
  }

  /**
   * Handles the closing event
   */
  _onClosing() {
    this._watcher.stop();
    this.emit("closing");
  }

  /**
   * Handles the closed event
   */
  _onClosed() {
    this.emit("closed");
  }

  ////////////////////////////////////////////
  // ABSTRACT

  /* istanbul ignore next */
  _onMessage() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendSubTicker() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendSubBookTicker() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendSubAllBookTicker() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendSubCandles() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendUnsubCandles() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendUnsubTicker() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendUnsubBookTicker() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendUnsubAllBookTicker() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendSubTrades() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendUnsubTrades() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendSubLevel2Snapshots() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendSubLevel2Updates() {
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  _sendSubLevel3Updates() {
    throw new Error("not implemented");
  }
}

module.exports = BasicTradeClient;
