const { EventEmitter } = require("events");
const winston = require("winston");
const SmartWss = require("./smart-wss");

/**
 * Single websocket connection client with
 * subscribe and unsubscribe methods. It is also an EventEmitter
 * and broadcasts 'trade' events.
 *
 * Anytime the WSS client connects (such as a reconnect)
 * it run the _onConnected method and will resubscribe.
 */
class BasicTradeClient extends EventEmitter {
  constructor(wssPath, name) {
    super();
    this._wssPath = wssPath;
    this._name = name;
    this._subscriptions = new Map();
    this._level2Subs = new Map();
    this._level3Subs = new Map();
    this._wss = undefined;
    this.reconnectIntervalMs = 90000;
    this._lastMessage = undefined;
    this._reconnectIntervalHandle = undefined;
  }

  //////////////////////////////////////////////

  close(emitClosed = true) {
    this._stopReconnectWatcher();
    if (this._wss) {
      this._wss.close();
      this._wss = undefined;
    }
    if (emitClosed) this.emit("closed");
  }

  subscribeTrades(market) {
    this._subscribe(
      market,
      this._subscriptions,
      "subscribing to trades",
      this._sendSubscribe.bind(this)
    );
  }

  unsubscribeTrades(market) {
    this._unsubscribe(
      market,
      this._subscriptions,
      "unsubscribing from trades",
      this._sendUnsubscribe.bind(this)
    );
  }

  subscribeLevel2(market) {
    this._subscribe(
      market,
      this._level2Subs,
      "subscribing to level 2",
      this._sendSubLevel2.bind(this)
    );
  }

  unsubcribeLevel2(market) {
    this._unsubscribe(
      market,
      this._level2Subs,
      "unsubscribing to level 2",
      this._sendUnsubLevel2.bind(this)
    );
  }

  subscribeLevel3(market) {
    this._subscribe(
      market,
      this._level3Subs,
      "subscribing to level 3",
      this._sendSubLevel3.bind(this)
    );
  }

  unsubscribeLevel3(market) {
    this._unsubscribe(
      market,
      this._level3Subs,
      "unsubscribing from level 3",
      this._sendUnsubLevel3.bind(this)
    );
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
   */
  _subscribe(market, map, msg, sendFn) {
    this._connect();
    let remote_id = market.id;
    if (!map.has(remote_id)) {
      winston.info(msg, this._name, remote_id);
      map.set(remote_id, market);

      // perform the subscription if we're connected
      // and if not, then we'll reply on the _onConnected event
      // to send the signal to our server!
      if (this._wss.isConnected) {
        sendFn(remote_id);
      }
    }
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
  _unsubscribe(market, map, msg, sendFn) {
    let remote_id = market.id;
    if (map.has(remote_id)) {
      winston.info("unsubscribing from", this._name, remote_id);
      map.delete(remote_id);

      if (this._wss.isConnected) {
        sendFn(remote_id);
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
      this._wss = new SmartWss(this._wssPath);
      this._wss.on("open", this._onConnected.bind(this));
      this._wss.on("message", msg => {
        this._lastMessage = Date.now();
        this._onMessage(msg);
      });
      this._wss.on("disconnected", this._onDisconnected.bind(this));
      this._wss.connect();
    }
  }

  /**
   * This method is fired anytime the socket is opened, whether
   * the first time, or any subsequent reconnects. This allows
   * the socket to immediate trigger resubscription to relevent
   * feeds
   */
  _onConnected() {
    this.emit("connected");
    for (let marketSymbol of this._subscriptions.keys()) {
      this._sendSubscribe(marketSymbol);
    }
    for (let marketSymbol of this._level2Subs.keys()) {
      this._sendSubLevel2(marketSymbol);
    }
    for (let marketSymbol of this._level3Subs.keys()) {
      this._sendSubLevel3(marketSymbol);
    }
    this._startReconnectWatcher();
  }

  /**
   * Handles a disconnection event
   */
  _onDisconnected() {
    this._stopReconnectWatcher();
    this.emit("disconnected");
  }

  /**
   * Reconnects the socket
   */
  _reconnect() {
    this.close(false);
    this._connect();
    this.emit("reconnected");
  }

  /**
   * Starts an interval to check if a reconnction is required
   */
  _startReconnectWatcher() {
    this._stopReconnectWatcher(); // always clear the prior interval
    this._reconnectIntervalHandle = setInterval(
      this._onReconnectCheck.bind(this),
      this.reconnectIntervalMs
    );
  }

  /**
   * Stops an interval to check if a reconnection is required
   */
  _stopReconnectWatcher() {
    clearInterval(this._reconnectIntervalHandle);
    this._reconnectIntervalHandle = undefined;
  }

  /**
   * Checks if a reconnecton is required by comparing the current
   * date to the last receieved message date
   */
  _onReconnectCheck() {
    if (this._lastMessage < Date.now() - this.reconnectIntervalMs) {
      this._reconnect();
    }
  }

  ////////////////////////////////////////////
  // ABSTRACT

  /**
   * IMPLEMENT handler for messages
   */
  _onMessage() {
    /* istanbul ignore next */
    throw new Error("not implemented");
  }

  /**
   * IMPLEMENT method that sends subscribe message
   */
  _sendSubscribe() {
    /* istanbul ignore next */
    throw new Error("not implemented");
  }

  /**
   * IMPLEMENT method to send unsubscribe message
   */

  _sendUnsubscribe() {
    /* istanbul ignore next */
    throw new Error("not implemented");
  }
}

module.exports = BasicTradeClient;
