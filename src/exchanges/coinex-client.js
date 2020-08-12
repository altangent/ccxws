const moment = require("moment");
const BasicClient = require("../basic-client");
const BasicMultiClient = require("../basic-multiclient");
const Watcher = require("../watcher");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const { MarketObjectTypes } = require("../enums");

class CoinexClient extends BasicMultiClient {
  constructor() {
    super();

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
  }

  _createBasicClient() {
    return new CoinexSingleClient();
  }
}

class CoinexSingleClient extends BasicClient {
  constructor() {
    super("wss://socket.coinex.com/", "Coinex");
    this._watcher = new Watcher(this, 15 * 60 * 1000);
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = false;
    this.retryErrorTimeout = 15000;
    this._id = 0;
    this._idSubMap = new Map();
  }

  _beforeConnect() {
    this._wss.on("connected", this._startPing.bind(this));
    this._wss.on("disconnected", this._stopPing.bind(this));
    this._wss.on("closed", this._stopPing.bind(this));
  }

  _startPing() {
    clearInterval(this._pingInterval);
    this._pingInterval = setInterval(this._sendPing.bind(this), 30000);
  }

  _stopPing() {
    clearInterval(this._pingInterval);
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send(
        JSON.stringify({
          method: "server.ping",
          params: [],
          id: ++this._id,
        })
      );
    }
  }

  _failSubscription(id) {
    // find the subscription
    let sub = this._idSubMap.get(id);
    if (!sub) return;

    // unsubscribe from the appropriate event
    let { type, remote_id } = sub;

    // unsubscribe from the appropriate thiing
    switch (type) {
      case MarketObjectTypes.ticker:
        this.unsubscribeTicker(remote_id);
        break;
      case MarketObjectTypes.trade:
        this.unsubscribeTrades(remote_id);
        break;
      case MarketObjectTypes.level2update:
        this.unsubscribeLevel2Updates(remote_id);
        break;
    }
    // remove the value
    this._idSubMap.delete(id);
  }

  _sendSubTicker(remote_id) {
    let id = this._id++;
    this._idSubMap.set(id, { remote_id, type: MarketObjectTypes.ticker });
    this._wss.send(
      JSON.stringify({
        method: "state.subscribe",
        params: [remote_id],
        id,
      })
    );
  }

  _sendUnsubTicker() {
    this._wss.send(
      JSON.stringify({
        method: "state.unsubscribe",
      })
    );
  }

  _sendSubTrades(remote_id) {
    let id = this._id++;
    this._idSubMap.set(id, { remote_id, type: MarketObjectTypes.trade });
    this._wss.send(
      JSON.stringify({
        method: "deals.subscribe",
        params: [remote_id],
        id,
      })
    );
  }

  _sendUnsubTrades() {
    this._wss.send(
      JSON.stringify({
        method: "deals.unsubscribe",
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    let id = this._id++;
    this._idSubMap.set(id, { remote_id, type: MarketObjectTypes.level2update });
    this._wss.send(
      JSON.stringify({
        method: "depth.subscribe",
        params: [remote_id, 50, "0"],
        id,
      })
    );
  }

  _sendUnsubLevel2Updates() {
    this._wss.send(
      JSON.stringify({
        method: "depth.unsubscribe",
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    let { error, method, params, id } = msg;

    // unsubscribe on failures
    if (error) {
      this.emit("error", msg);
      this._failSubscription(id);
      return;
    }

    // if params is not defined, then this is a response to an event
    // that we don't care about (like the initial connection event)
    if (!params) return;

    if (method === "state.update") {
      let marketId = Object.keys(params[0])[0];
      let market = this._tickerSubs.get(marketId);
      if (!market) return;

      let ticker = this._constructTicker(params[0][marketId], market);
      this.emit("ticker", ticker, market);
      return;
    }

    if (method === "deals.update") {
      let marketId = params[0];
      let market = this._tradeSubs.get(marketId);
      if (!market) return;

      for (let t of params[1].reverse()) {
        let trade = this._constructTrade(t, market);
        this.emit("trade", trade, market);
      }
      return;
    }

    if (method === "depth.update") {
      let marketId = params[2];
      let market = this._level2UpdateSubs.get(marketId);
      if (!market) return;

      let isLevel2Snapshot = params[0];
      if (isLevel2Snapshot) {
        let l2snapshot = this._constructLevel2Snapshot(params[1], market);
        this.emit("l2snapshot", l2snapshot, market);
      } else {
        let l2update = this._constructLevel2Update(params[1], market);
        this.emit("l2update", l2update, market);
      }
      return;
    }
  }

  _constructTicker(rawTick, market) {
    let { last, open, high, low, volume, deal } = rawTick,
      change = parseFloat(last) - parseFloat(open),
      changePercent = ((parseFloat(last) - parseFloat(open)) / parseFloat(open)) * 100;

    return new Ticker({
      exchange: "Coinex",
      base: market.base,
      quote: market.quote,
      timestamp: Date.now(),
      last: last,
      open: open,
      high: high,
      low: low,
      volume: volume,
      quoteVolume: deal,
      change: change.toFixed(8),
      changePercent: changePercent.toFixed(8),
    });
  }

  _constructTrade(rawTrade, market) {
    let { id, time, type, price, amount } = rawTrade;

    let unix = moment.utc(time * 1000).valueOf();

    return new Trade({
      exchange: "Coinex",
      base: market.base,
      quote: market.quote,
      tradeId: id.toFixed(),
      unix: unix,
      side: type,
      price,
      amount,
      buyOrderId: undefined,
      sellOrderId: undefined,
    });
  }

  _constructLevel2Snapshot(rawUpdate, market) {
    let { bids, asks } = rawUpdate,
      structuredBids = bids ? bids.map(([price, size]) => new Level2Point(price, size)) : [],
      structuredAsks = asks ? asks.map(([price, size]) => new Level2Point(price, size)) : [];

    return new Level2Snapshot({
      exchange: "Coinex",
      base: market.base,
      quote: market.quote,
      bids: structuredBids,
      asks: structuredAsks,
    });
  }

  _constructLevel2Update(rawUpdate, market) {
    let { bids, asks } = rawUpdate,
      structuredBids = bids ? bids.map(([price, size]) => new Level2Point(price, size)) : [],
      structuredAsks = asks ? asks.map(([price, size]) => new Level2Point(price, size)) : [];

    return new Level2Update({
      exchange: "Coinex",
      base: market.base,
      quote: market.quote,
      bids: structuredBids,
      asks: structuredAsks,
    });
  }
}

module.exports = CoinexClient;
