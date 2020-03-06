const Decimal = require("decimal.js");
const moment = require("moment");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class FtxClient extends BasicClient {
  constructor() {
    super("wss://ftx.com/ws", "FTX");
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;

    this._orderbookSnapshotSubs = new Map();
    this._orderbookUpdateSubs = new Map();
  }

  _sendSubTicker(market) {
    if (this._isSpotMarket(market)) {
      this._wss.send(
        JSON.stringify({
          op: "subscribe",
          channel: "ticker",
          market,
        })
      );
    }
  }

  _sendUnsubTicker(market) {
    if (this._isSpotMarket(market)) {
      this._wss.send(
        JSON.stringify({
          op: "unsubscribe",
          channel: "ticker",
          market,
        })
      );
    }
  }

  _sendSubTrades(market) {
    if (this._isSpotMarket(market)) {
      this._wss.send(
        JSON.stringify({
          op: "subscribe",
          channel: "trades",
          market,
        })
      );
    }
  }

  _sendUnsubTrades(market) {
    if (this._isSpotMarket(market)) {
      this._wss.send(
        JSON.stringify({
          op: "unsubscribe",
          channel: "trades",
          market,
        })
      );
    }
  }

  _sendSubLevel2Snapshots(market) {
    this._subscribeToOrderbook("snapshot", market);
  }

  _sendUnsubLevel2Snapshots(market) {
    this._unsubscribeFromOrderbook("snapshot", market);
  }

  _sendSubLevel2Updates(market) {
    this._subscribeToOrderbook("update", market);
  }

  _sendUnsubLevel2Updates(market) {
    this._unsubscribeFromOrderbook("update", market);
  }

  _subscribeToOrderbook(type, market) {
    if (!this._isSpotMarket(market)) {
      return;
    }

    const shouldSubscribe =
      !this._orderbookSnapshotSubs.has(market) &&
      !this._orderbookUpdateSubs.has(market);

    if (type === "snapshot") {
      this._orderbookSnapshotSubs.set(market, true);
    } else {
      this._orderbookUpdateSubs.set(market, true);
    }

    if (shouldSubscribe) {
      this._wss.send(
        JSON.stringify({
          op: "subscribe",
          channel: "orderbook",
          market,
        })
      );
    }
  }

  _unsubscribeFromOrderbook(type, market) {
    if (!this._isSpotMarket(market)) {
      return;
    }

    if (type === "snapshot") {
      this._orderbookSnapshotSubs.delete(market);
    } else {
      this._orderbookUpdateSubs.delete(market);
    }

    if (!this._orderbookSnapshotSubs.has(market) && !this._orderbookUpdateSubs.has(market)) {
      this._wss.send(
        JSON.stringify({
          op: "subscribe",
          channel: "orderbook",
          market,
        })
      );
    }
  }

  _onMessage(raw) {
    const { type, channel, market: symbol, data } = JSON.parse(raw);

    if (!type || !channel || !symbol) {
      return;
    }

    switch (channel) {
      case "ticker":
        this._tickerMessageHandler(data, symbol);
        break;
      case "trades":
        this._tradesMessageHandler(data, symbol);
        break;
      case "orderbook":
        this._orderbookMessageHandler(data, symbol, type);
        break;
    }
  }

  _tickerMessageHandler(data, symbol) {
    if (!data || !symbol) {
      return;
    }

    const market = this._tickerSubs.get(symbol);
    if (!market.base || !market.quote) {
      return;
    }

    const timestamp = this._timeToTimestampMs(data.time);
    const { last, bid, ask, bidSize: bidVolume, askSize: askVolume } = data;
    const ticker = new Ticker({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestamp,
      last: last !== undefined && last !== null ? last.toFixed(8) : undefined,
      bid: bid !== undefined && bid !== null ? bid.toFixed(8) : undefined,
      ask: ask !== undefined && ask !== null ? ask.toFixed(8) : undefined,
      bidVolume: bidVolume !== undefined && bidVolume !== null ? bidVolume.toFixed(8) : undefined,
      askVolume: askVolume !== undefined && askVolume !== null ? askVolume.toFixed(8) : undefined,
    });

    this.emit("ticker", ticker, market);
  }

  _tradesMessageHandler(data, symbol) {
    if (!data || !symbol) {
      return;
    }

    const market = this._tradeSubs.get(symbol);
    if (!market.base || !market.quote) {
      return;
    }

    for (let entry of data) {
      const { id, price, size, side, time, liquidation } = entry;
      const unix = moment.utc(time).valueOf();

      const trade = new Trade({
        exchange: this._name,
        base: market.base,
        quote: market.quote,
        tradeId: id.toString(),
        side,
        unix,
        price: price.toFixed(8),
        amount: size.toFixed(8),
        liquidation,
      });

      this.emit("trade", trade, market);
    }
  }

  _orderbookMessageHandler(data, symbol, type) {
    switch (type) {
      case "partial":
        this._orderbookSnapshotEvent(data, symbol);
        break;
      case "update":
        this._orderbookUpdateEvent(data, symbol);
        break;
    }
  }

  _orderbookSnapshotEvent(data, symbol) {
    if (!data || !symbol || !this._orderbookSnapshotSubs.has(symbol)) {
      return;
    }

    const market = this._level2SnapshotSubs.get(symbol);
    const content = this._orderbookEventContent(data, market);
    const eventData = new Level2Snapshot(content);
    this.emit("l2snapshot", eventData, market);
  }

  _orderbookUpdateEvent(data, symbol) {
    if (
      !data ||
      !symbol ||
      !this._orderbookUpdateSubs.has(symbol) ||
      (!data.asks.length && !data.bids.length)
    ) {
      return;
    }

    const market = this._level2UpdateSubs.get(symbol);
    const content = this._orderbookEventContent(data, market);
    const eventData = new Level2Update(content);
    this.emit("l2update", eventData, market);
  }

  _orderbookEventContent(data, market) {
    const { time, asks, bids } = data;
    const level2PointAsks = asks.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
    const level2PointBids = bids.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
    const timestampMs = this._timeToTimestampMs(time);

    return {
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs,
      asks: level2PointAsks,
      bids: level2PointBids,
      type: market.type,
    };
  }

  _timeToTimestampMs(time) {
    return new Decimal(time)
      .mul(1000)
      .toDecimalPlaces(0)
      .toNumber();
  }

  _isSpotMarket(id) {
    const isSpot = id.includes("/");
    return isSpot;
  }
}

module.exports = FtxClient;
