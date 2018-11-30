const crypto = require("crypto");
const Ticker = require("../ticker");
//const winston = require("winston");
const BasicClient = require("../basic-client");

class CexClient extends BasicClient {
  constructor(auth) {
    super("wss://ws.cex.io/ws", "CEX");
    this.auth = auth;
    this.hasTickers = true;
    this.hasTrades = false;
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

  _sendAuthorizeRequest() {
    this._wss.send(
      JSON.stringify({
        e: "auth",
        auth: this.createAuthToken(this.auth.apiKey, this.auth.apiSecret),
      })
    );
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

  _constructTicker(rawTick, market) {
    let { open24, price, volume } = rawTick,
      change = parseFloat(price) - parseFloat(open24),
      changePercent =
        open24 !== 0 ? ((parseFloat(price) - parseFloat(open24)) / parseFloat(open24)) * 100 : 0;

    return new Ticker({
      exchange: "CEX",
      base: market.base,
      quote: market.quote,
      timestamp: Date.now(),
      last: price,
      open: open24,
      high: null,
      low: null,
      volume: volume,
      quoteVolume: null,
      change: change.toFixed(8),
      changePercent: changePercent.toFixed(8),
    });
  }

  _onMessage(raw) {
    let message = JSON.parse(raw);
    let { e, data } = message;

    if (e === "ping") {
      this._sendPong();
      return;
    }

    if (e === "auth") {
      if (data.ok === "ok") {
        this._onAuthorized();
      } else {
        throw "Authentication error";
      }
      return;
    }

    if (e === "tick") {
      // {"e":"tick","data":{"symbol1":"BTC","symbol2":"USD","price":"4244.4","open24":"4248.4","volume":"935.58669239"}}
      let marketId = data.symbol1 + "-" + data.symbol2;
      if (this._tickerSubs.has(marketId)) {
        let market = this._tickerSubs.get(marketId);
        let ticker = this._constructTicker(data, market);
        this.emit("ticker", ticker);
      }
      return;
    }
  }
}

module.exports = CexClient;
