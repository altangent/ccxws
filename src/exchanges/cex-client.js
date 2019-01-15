const winston = require("winston");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const BasicAuthClient = require("../basic-auth-client");
const BasicMultiClient = require("../basic-multiclient");

class CexClient extends BasicMultiClient {
  constructor(args) {
    super();
    this._clients = new Map();

    this._name = "CEX_MULTI";
    this.auth = args;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
  }

  _createBasicClient(clientArgs) {
    return new SingleCexClient({ auth: this.auth, market: clientArgs.market });
  }
}

class SingleCexClient extends BasicAuthClient {
  constructor(args) {
    super("wss://ws.cex.io/ws", "CEX");
    this.auth = args.auth;
    this.market = args.market;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
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
    winston.info("subscribing to level2 snapshots", "SINGLE CEX", localRemote_id);
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
      if (this._tickerSubs.has(marketId) && marketId === this.market.id) {
        let market = this._tickerSubs.get(marketId);
        let ticker = this._constructTicker({ raw: data, market: market });
        this.emit("ticker", ticker);
      }
      return;
    }

    if (e === "md") {
      let marketId = data.pair.replace(":", "-");
      if (this._level2SnapshotSubs.has(marketId) && marketId === this.market.id) {
        let result = this._constructevel2Snapshot(data);
        this.emit("l2snapshot", result);
        return;
      }
    }

    if (e === "history") {
      let marketId = this.market.id;
      let market = this._tradeSubs.get(marketId);
      if (this._tradeSubs.has(marketId)) {
        // sell/buy:timestamp_ms:amount:price:transaction_id
        for (let rawTrade of data) {
          let tradeData = rawTrade.split(":");
          let trade = this._constructTrade(tradeData, market);
          this.emit("trade", trade);
        }
      }
      return;
    }

    if (e === "history-update") {
      let marketId = this.market.id;
      let market = this._tradeSubs.get(marketId);
      if (this._tradeSubs.has(marketId)) {
        for (let rawTrade of data) {
          let trade = this._constructTrade(rawTrade, market);
          this.emit("trade", trade);
        }
        return;
      }
    }
  }
}

module.exports = CexClient;
