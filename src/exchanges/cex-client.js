const winston = require("winston");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const BasicAuthClient = require("../basic-auth-client");
const BasicMultiClient = require("../basic-multiclient");
const MarketObjectTypes = require("../enums");

class CexClient extends BasicMultiClient {
  constructor(auth) {
    super();
    this._clients = new Map();

    this.singleClientType = SingleCexClient;
    this._name = "CEX_MULTI";
    this.auth = auth;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
  }

  subscribeLevel2Snapshots(market) {
    if (!this.hasLevel2Snapshots) return;
    this._subscribe(
      market,
      this._clients,
      MarketObjectTypes.level2snapshot,
      "subscribing to level 2 snapshots"
    );
  }

  unsubscribeLevel2Snapshots(market) {
    if (!this.hasLevel2Snapshots) return;
    if (this._clients.has(market.id)) {
      this._clients.get(market.id).unsubscribeLevel2Snapshots(market);
    }
  }

  _subscribe(market, map, marketObjectType, msg) {
    let remote_id = market.id,
      client = null;

    if (!map.has(remote_id)) {
      let clientAuth = { apiKey: this.auth.apiKey, apiSecret: this.auth.apiSecret, market: market };
      client = new this.singleClientType(clientAuth);
      console.log("Map adding remote_Id " + remote_id);
      map.set(market, client);
    } else {
      console.log("Map already has remote_Id " + remote_id);
      client = map.get(remote_id);
    }

    if (marketObjectType === MarketObjectTypes.ticker) {
      winston.info(msg, this._name, remote_id);

      client.subscribeTicker(market);

      client.on("ticker", ticker => {
        this.emit("ticker", ticker);
      });
    }

    if (marketObjectType === MarketObjectTypes.trade) {
      winston.info(msg, this._name, remote_id);

      client.subscribeTrades(market);

      client.on("trade", trade => {
        this.emit("trade", trade);
      });
    }

    // if (marketObjectType === MarketObjectTypes.level2update) {
    //   winston.info(msg, this._name, remote_id);

    //   client.subscribeLevel2Updates(market);

    //   client.on("l2update", l2update => {
    //     this.emit("l2update", l2update);
    //   });
    // }

    if (marketObjectType === MarketObjectTypes.level2snapshot) {
      winston.info(msg, this._name, remote_id);

      client.subscribeLevel2Snapshots(market);

      client.on("l2snapshot", l2snapshot => {
        this.emit("l2snapshot", l2snapshot);
      });
    }
  }
}

class SingleCexClient extends BasicAuthClient {
  constructor(auth) {
    super("wss://ws.cex.io/ws", "CEX");
    this.auth = auth;
    this.market = auth.market;
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

    winston.log(message);

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
      for (let rawTrade of data) {
        let trade = this._constructTrade(rawTrade, market);
        this.emit("trade", trade);
      }
      return;
    }
  }
}

module.exports = CexClient;
