const crypto = require("crypto");
const winston = require("winston");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const BasicClient = require("../basic-client");

class CexClient extends BasicClient {
  constructor(auth) {
    super("wss://ws.cex.io/ws", "CEX");
    this.auth = auth;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
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
    winston.info("authorized", "CEX");
    for (let marketSymbol of this._tickerSubs.keys()) {
      this._sendSubTicker(marketSymbol);
    }
    for (let marketSymbol of this._tradeSubs.keys()) {
      this._sendSubTrades(`pair-${marketSymbol}`);
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

  _sendUnsubTicker() {}

  _sendSubTrades(remote_id) {
    let localRemote_id = remote_id; //`pair-${remote_id}`;
    winston.info("subscribing to trades", "CEX", localRemote_id);
    this._wss.send(
      JSON.stringify({
        e: "subscribe",
        rooms: [remote_id],
      })
    );
  }

  _sendUnsubTrades() {}

  _sendSubLevel2Snapshots(remote_id) {
    let localRemote_id = remote_id;
    winston.info("subscribing to level2 snapshots", "CEX", localRemote_id);
    this._wss.send(
      JSON.stringify({
        e: "subscribe",
        rooms: [remote_id],
      })
    );
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

  _constructevel2Snapshot(msg) {
    let marketId = msg.pair.replace(":", "-"); // api has an inconsistent delimeter between subscribe and order book.
    let market = this._level2SnapshotSubs.get(marketId);
    winston.info("Market", market);
    let asks = msg.sell.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
    let bids = msg.buy.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));

    return new Level2Snapshot({
      exchange: "CEX",
      base: market.base,
      quote: market.quote,
      sequenceId: msg.id,
      asks,
      bids,
    });
  }

  _constructTrade(data, market) {
    //["buy","1543967891439","4110282","3928.1","9437977"]
    //format: sell/buy, timestamp_ms, amount, price, transaction_id
    let [side, timestamp_ms, amount, price, tradeId] = data;

    return new Trade({
      exchange: "CEX",
      base: market.base,
      quote: market.quote,
      tradeId: tradeId,
      unix: parseInt(timestamp_ms),
      side: side,
      price: price,
      amount: amount,
    });
  }

  _onMessage(raw) {
    let message = JSON.parse(raw);
    let { e, data } = message;

    if (e === "ping") {
      this._sendPong();
      return;
    }

    if (e === "subscribe") {
      if (message.error) {
        throw new Error(`CEX error: ${message.error}`);
      }
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
      let marketId = `${data.symbol1}-${data.symbol2}`;
      if (this._tickerSubs.has(marketId)) {
        let market = this._tickerSubs.get(marketId);
        let ticker = this._constructTicker({ raw: data, market: market });
        this.emit("ticker", ticker);
      }
      return;
    }

    if (e === "md") {
      let marketId = data.pair.replace(":", "-");
      if (this._level2SnapshotSubs.has(marketId)) {
        let result = this._constructevel2Snapshot(data);
        this.emit("l2snapshot", result);
        return;
      }
    }

    if (e === "history") {
      let marketId = `BTC-USD`;
      let market = this._tradeSubs.get(marketId);
      // sell/buy:timestamp_ms:amount:price:transaction_id
      for (let rawTrade of data) {
        let tradeData = rawTrade.split(":");
        let trade = this._constructTrade(tradeData, market);
        this.emit("trade", trade);
      }
      return;
    }

    if (e === "history-update") {
      let marketId = `BTC-USD`;
      let market = this._tradeSubs.get(marketId);
      for (let rawTrade of data) {
        let trade = this._constructTrade(rawTrade, market);
        this.emit("trade", trade);
      }
      return;
    }
  }
}

module.exports = CexClient;
