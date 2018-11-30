const crypto = require("crypto");
const BasicClient = require("../basic-client");

class CexClient extends BasicClient {
  constructor(auth) {
    super("wss://ws.cex.io/ws", "CEX");
    this.auth = auth;
    this.hasTickers = true;
  }

  createSignature(timestamp, apiKey, apiSecret) {
    var hmac = crypto.createHmac("sha256", apiSecret);
    hmac.update(timestamp + apiKey);
    return hmac.digest("hex");
  }

  createAuthToken(apiKey, apiSecret) {
    var timestamp = Math.floor(Date.now() / 1000); // Note: java and javascript timestamp presented in miliseconds
    return {
      key: apiKey,
      signature: this.createSignature(timestamp, apiKey, apiSecret),
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
    for (let marketSymbol of this._tickerSubs.keys()) {
      this._sendSubTicker(marketSymbol);
    }
    for (let marketSymbol of this._tradeSubs.keys()) {
      this._sendSubTrades(marketSymbol);
    }
    for (let marketSymbol of this._level2SnapshotSubs.keys()) {
      this._sendSubLevel2Snapshots(marketSymbol);
    }
    for (let marketSymbol of this._level2UpdateSubs.keys()) {
      this._sendSubLevel2Updates(marketSymbol);
    }
    for (let marketSymbol of this._level3UpdateSubs.keys()) {
      this._sendSubLevel3Updates(marketSymbol);
    }
    this._watcher.start();
  }

  _sendPong() {
    if (this._wss) {
      this._wss.send(JSON.stringify({ e: "pong" }));
    }
  }

  _sendSubTicker() {
    this._wss.send(
      JSON.stringify({
        e: "subscribe",
        rooms: ["tickers"],
      })
    );
  }

  _sendUnsubTicker() {}

  _sendAuthorizeRequest() {
    this._wss.send(
      JSON.stringify({
        e: "auth",
        auth: this.createAuthToken(this.auth.apiKey, this.auth.apiSecret),
      })
    );
  }

  _onMessage(raw) {
    let message = JSON.parse(raw);
    let { e, data } = message;

    console.log(raw);

    if (e === "ping") {
      this._sendPong();
      return;
    }

    if (e === "auth") {
      if (data.ok === "ok") {
        this._onAuthorized();
      }
      return;
    }

    if (e === "tick") {
      //let ticker = this._constructTicker(params[0][marketId], market);
      //this.emit("ticker", ticker);
      return;
    }
  }
}

module.exports = CexClient;
