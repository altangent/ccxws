const moment = require("moment");
const BasicClient = require("../basic-client");
const Watcher = require("../watcher");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class GateioClient extends BasicClient {
  /**
   * Gate.io now supports subscribing to multiple markets from a single socket connection.
   * These requests will be debounced so that multiple subscriptions will trigger a
   * single call to subscribe.
   *
   * Additionally, depending on the REST method used, the market_id's will be lower
   * or uppercase. Websockets require market_id in uppercase, however the client
   * can handle either.
   */
  constructor() {
    super("wss://ws.gate.io/v3", "Gateio");
    this._watcher = new Watcher(this, 15 * 60 * 1000);
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = false;
    this.debounceWait = 100;
    this._debounceHandles = new Map();
  }

  _debounce(type, fn) {
    clearTimeout(this._debounceHandles.get(type));
    this._debounceHandles.set(type, setTimeout(fn, this.debounceWait));
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
        })
      );
    }
  }

  _sendSubTicker() {
    this._debounce("sub-ticker", () => {
      let markets = Array.from(this._tickerSubs.keys()).map(m => m.toUpperCase()); // must be uppercase
      this._wss.send(
        JSON.stringify({
          method: "ticker.subscribe",
          params: markets,
          id: 1,
        })
      );
    });
  }

  _sendUnsubTicker() {
    this._wss.send(
      JSON.stringify({
        method: "ticker.unsubscribe",
      })
    );
  }

  _sendSubTrades() {
    this._debounce("sub-trades", () => {
      let markets = Array.from(this._tradeSubs.keys()).map(m => m.toUpperCase()); // must be uppercase
      this._wss.send(
        JSON.stringify({
          method: "trades.subscribe",
          params: markets,
          id: 1,
        })
      );
    });
  }

  _sendUnsubTrades() {
    this._wss.send(
      JSON.stringify({
        method: "trades.unsubscribe",
      })
    );
  }

  _sendSubLevel2Updates() {
    this._debounce("sub-l2updates", () => {
      let markets = Array.from(this._level2UpdateSubs.keys()).map(m => m.toUpperCase()); // must be uppercase
      this._wss.send(
        JSON.stringify({
          method: "depth.subscribe",
          params: markets.map(m => [m, 30, "0"]),
          id: 1,
        })
      );
    });
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
      let market =
        this._tickerSubs.get(marketId.toUpperCase()) ||
        this._tickerSubs.get(marketId.toLowerCase());
      if (!market) return;

      let ticker = this._constructTicker(params[1], market); //params[0][marketId] -> params[1]
      this.emit("ticker", ticker, market);
      return;
    }

    if (method === "trades.update") {
      let marketId = params[0];
      let market =
        this._tradeSubs.get(marketId.toUpperCase()) || this._tradeSubs.get(marketId.toLowerCase());
      if (!market) return;

      params[1].reverse().forEach(t => {
        let trade = this._constructTrade(t, market);
        this.emit("trade", trade, market);
      });
      return;
    }

    if (method === "depth.update") {
      let marketId = params[2];
      let market =
        this._level2UpdateSubs.get(marketId.toUpperCase()) ||
        this._level2UpdateSubs.get(marketId.toLowerCase());
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
      tradeId: id.toFixed(),
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
