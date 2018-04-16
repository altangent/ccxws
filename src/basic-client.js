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
    this._wss = undefined;
  }

  //////////////////////////////////////////////

  subscribe(market) {
    this._connect();
    let remote_id = market.id || market.remote_id;
    if (!this._subscriptions.has(remote_id)) {
      winston.info("subscribing to", this._name, remote_id);
      this._subscriptions.set(remote_id, market);
      this._sendSubscribe(remote_id);
    }
  }

  unsubscribe(market) {
    let remote_id = market.id;
    if (this._subscriptions.has(remote_id)) {
      winston.info("unsubscribing from", this._name, remote_id);
      this._subscriptions.delete(market);
    }
  }

  ////////////////////////////////////////////
  // PROTECTED

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
      this._wss.on("message", this._onMessage.bind(this));
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
    for (let marketSymbol of this._subscriptions.keys()) {
      this._sendSubscribe(marketSymbol);
    }
  }

  ////////////////////////////////////////////
  // ABSTRACT

  /**
   * IMPLEMENT handler for messages
   */
  _onMessage() {
    throw new Error("not implemented");
  }

  /**
   * IMPLEMENT method that sends subscribe message
   */
  _sendSubscribe() {
    throw new Error("not implemented");
  }

  /**
   * IMPLEMENT method to send unsubscribe message
   */

  _sendUnsubscribe() {
    throw new Error("not implemented");
  }
}

module.exports = BasicTradeClient;
