const crypto = require("crypto");
const BasicClient = require("./basic-client");
const winston = require("winston");

/**
 * Single websocket connection client with
 * subscribe and unsubscribe methods. It is also an EventEmitter
 * and broadcasts 'trade' events.
 *
 * Anytime the WSS client connects (such as a reconnect)
 * it run the _onConnected method and will resubscribe.
 */
class BasicAuthTradeClient extends BasicClient {
  constructor(wssPath, name) {
    super(wssPath, name);
    this.name = name;
  }

  createSignature(timestamp) {
    var hmac = crypto.createHmac("sha256", this.auth.apiSecret);
    hmac.update(timestamp + this.auth.apiKey);
    return hmac.digest("hex");
  }

  createAuthToken() {
    var timestamp = Math.floor(Date.now() / 1000);
    return {
      key: this.auth.apiKey,
      signature: this.createSignature(timestamp),
      timestamp: timestamp,
    };
  }

  /**
   * This method is fired anytime the socket is opened, whether
   * the first time, or any subsequent reconnects.
   * Since this is an authenticated feed, we just send an authenticate
   * request, and the normal subscriptions happen after authentication.
   */
  _onConnected() {
    this.emit("connected");
    this._sendAuthorizeRequest();
  }

  /**
   * This event implements what _onConnect normally does.
   */
  _onAuthorized() {
    this.emit("authorized");
    winston.info("authenticated ", this.name);
    for (let marketSymbol of this._tickerSubs.keys()) {
      this._sendSubTicker(marketSymbol);
    }
    for (let marketSymbol of this._bookTickerSubs.keys()) {
      this._sendSubBookTicker(marketSymbol);
    }
    if (this._allBookTickerSubs) {
      this._sendSubAllBookTicker();
    }
    for (let marketSymbol of this._candleSubs.keys()) {
      this._sendSubCandle(marketSymbol);
    }
    for (let marketSymbol of this._tradeSubs.keys()) {
      this._sendSubTrades(`pair-${marketSymbol}`);
    }
    for (let marketSymbol of this._level2SnapshotSubs.keys()) {
      this._sendSubLevel2Snapshots(`pair-${marketSymbol}`);
    }
    for (let marketSymbol of this._level2UpdateSubs.keys()) {
      this._sendSubLevel2Updates(marketSymbol);
    }
    for (let marketSymbol of this._level3UpdateSubs.keys()) {
      this._sendSubLevel3Updates(marketSymbol);
    }
    this._watcher.start();
  }

  _sendAuthorizeRequest() {
    this._wss.send(
      JSON.stringify({
        e: "auth",
        auth: this.createAuthToken(),
      }),
    );
  }
}

module.exports = BasicAuthTradeClient;
