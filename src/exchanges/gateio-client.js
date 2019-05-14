const moment = require("moment");
const BasicClient = require("../basic-client");
const BasicMultiClient = require("../basic-multiclient");
const Watcher = require("../watcher");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class GateioClient extends BasicMultiClient {
  constructor() {
    super();

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
  }

  _createBasicClient() {
    return new GateioSingleClient();
  }
}

class GateioSingleClient extends BasicClient {
  constructor() {
    super("wss://ws.gate.io/v3", "Gateio");
    this.on("connected", this._startPing.bind(this));
    this.on("disconnected", this._stopPing.bind(this));
    this._watcher = new Watcher(this, 15 * 60 * 1000);
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = false;
  }

  _startPing() {
    this._pingInterval = setInterval(this._sendPing.bind(this), 30000);
  }

  _stopPing() {
    clearInterval(this._pingInterval)
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send(JSON.stringify({ 
        method: "server.ping"
      }));
    }
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "ticker.subscribe",
        params: [remote_id],
        id: 1,
      })
    );
  }

  _sendUnsubTicker() {
    this._wss.send(
      JSON.stringify({
        method: "ticker.unsubscribe",
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "trades.subscribe",
        params: [remote_id],
        id: 1,
      })
    );
  }

  _sendUnsubTrades() {
    this._wss.send(
      JSON.stringify({
        method: "trades.unsubscribe",
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "depth.subscribe",
        params: [remote_id, 30, "0"], // 100 is the maximum number of items Gateio will let you request
        id: 1,
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
    let { method, params } = msg;

    // if params is not defined, then this is a response to an event that we don't care about (like the initial connection event)
    if (!params) return;

    if (method === "ticker.update") {
      let marketId = params[0];
      let market = this._tickerSubs.get(marketId);
      if (!market) return;

      let ticker = this._constructTicker(params[1], market); //params[0][marketId] -> params[1]
      this.emit("ticker", ticker, market);
      return;
    }

    if (method === "trades.update") {
      let marketId = params[0];
      let market = this._tradeSubs.get(marketId);
      if (!market) return;

      params[1].forEach(t => {
        let trade = this._constructTrade(t, market);
        this.emit("trade", trade, market);
      });
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
    let change = parseFloat(rawTick.last) - parseFloat(rawTick.open);
    let changePercent =
      ((parseFloat(rawTick.last) - parseFloat(rawTick.open)) / parseFloat(rawTick.open)) * 100;

    return new Ticker({
      exchange: "Gateio",
      base: market.base,
      quote: market.quote,
      timestamp: Date.now(),
      last: rawTick.last,
      open: rawTick.open,
      high: rawTick.high,
      low: rawTick.low,
      volume: rawTick.baseVolume,
      quoteVolume: rawTick.quoteVolume,
      change: change.toFixed(8),
      changePercent: changePercent.toFixed(8),
    });
  }

  _constructTrade(rawTrade, market) {
    let { id, time, type, price, amount } = rawTrade;

    let unix = moment.utc(time * 1000).valueOf();

    return new Trade({
      exchange: "Gateio",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      unix,
      side: type,
      price,
      amount,
    });
  }

  _constructLevel2Snapshot(rawUpdate, market) {
    let { bids, asks } = rawUpdate,
      structuredBids = bids ? bids.map(([price, size]) => new Level2Point(price, size)) : [],
      structuredAsks = asks ? asks.map(([price, size]) => new Level2Point(price, size)) : [];

    return new Level2Snapshot({
      exchange: "Gateio",
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
      exchange: "Gateio",
      base: market.base,
      quote: market.quote,
      bids: structuredBids,
      asks: structuredAsks,
    });
  }
}

module.exports = GateioClient;
