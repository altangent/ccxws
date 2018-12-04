const crypto = require("crypto");
const Ticker = require("../ticker");
const winston = require("winston");
const BasicClient = require("../basic-client");

class CexClient extends BasicClient {
  constructor(auth) {
    super("wss://ws.cex.io/ws", "CEX");
    this.auth = auth;
    this.hasTickers = true;
    this.hasTrades = false;
  }

  createSignature(timestamp) {
    var hmac = crypto.createHmac("sha256", this.auth.apiSecret);
    hmac.update(timestamp + this.auth.apiKey);
    return hmac.digest("hex");
  }

  createAuthToken() {
    var timestamp = Math.floor(Date.now() / 1000); // Note: java and javascript timestamp presented in miliseconds
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
    winston.info("authorized", "CEX");
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
        auth: this.createAuthToken(),
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

  _sendUnsubTicker(market) {
    let remote_id = market.id;
    if (!this._tickerSubs.has(remote_id)) return;
    winston.info("unsubscribing to ticker", "CEX", remote_id);
    this._tickerSubs.delete(remote_id);
    if (this._wss) {
      this._sendUnsubTicker(remote_id);
    }
  }

  _constructTicker(data) {
    // {"e":"tick","data":{"symbol1":"BTC","symbol2":"USD","price":"4244.4","open24":"4248.4","volume":"935.58669239"}}
    let { open24, price, volume } = data.raw,
      { base, quote } = data.market,
      change = parseFloat(price) - parseFloat(open24),
      changePercent =
        open24 !== 0 ? ((parseFloat(price) - parseFloat(open24)) / parseFloat(open24)) * 100 : 0;

    return new Ticker({
      exchange: "CEX",
      base: base,
      quote: quote,
      timestamp: Date.now(),
      last: price,
      open: open24,
      volume: volume,
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
        throw new Error("Authentication error");
      }
      return;
    }

    if (e === "tick") {
      // {"e":"tick","data":{"symbol1":"BTC","symbol2":"USD","price":"4244.4","open24":"4248.4","volume":"935.58669239"}}
      let marketId = data.symbol1 + "-" + data.symbol2;
      if (this._tickerSubs.has(marketId)) {
        let market = this._tickerSubs.get(marketId);
        let ticker = this._constructTicker({ raw: data, market: market });
        this.emit("ticker", ticker);
      }
      return;
    }

    console.log(message);
  }
}

module.exports = CexClient;
