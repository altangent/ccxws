const zlib = require("../zlib");
const https = require("../https");
const { EventEmitter } = require("events");
const moment = require("moment");
const turdr = require("signalr-client");
const Watcher = require("../watcher");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Candle = require("../candle");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const Level2Point = require("../level2-point");
const { CandlePeriod } = require("../enums");

/**
 * Implements the v3 API:
 * https://bittrex.github.io/api/v3#topic-Synchronizing
 * https://bittrex.github.io/guides/v3/upgrade
 */
class BittrexClient extends EventEmitter {
  constructor() {
    super();
    this._name = "Bittrex";
    this._retryTimeoutMs = 15000;
    this._tickerSubs = new Map();
    this._tradeSubs = new Map();
    this._candleSubs = new Map();
    this._level2UpdateSubs = new Map();
    this._watcher = new Watcher(this);
    this._isConnected = false;
    this._tickerConnected = false;
    this._finalClosing = false;

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;
    this.candlePeriod = CandlePeriod._1m;
    this.orderBookDepth = 500;

    this._processTickers = this._processTickers.bind(this);
    this._processTrades = this._processTrades.bind(this);
    this._processCandles = this._processCandles.bind(this);
    this._processLevel2Update = this._processLevel2Update.bind(this);
  }

  close(emitEvent = true) {
    if (emitEvent) {
      // if user activated close, we flag this
      // so we don't attempt to reconnect
      this._finalClosing = true;
    }
    this._watcher.stop();
    if (this._wss) {
      try {
        this._wss.end();
      } catch (e) {
        // ignore
      }
      this._wss = undefined;
    }
    if (emitEvent) this.emit("closed");
  }

  reconnect(emitEvent = true) {
    this.close(false);
    this._connect();
    if (emitEvent) this.emit("reconnected");
  }

  subscribeTicker(market) {
    let remote_id = market.id;
    if (this._tickerSubs.has(remote_id)) return;

    this._connect();
    this._tickerSubs.set(remote_id, market);
    if (this._isConnected) {
      this._sendSubTickers(remote_id);
    }
  }

  unsubscribeTicker(market) {
    let remote_id = market.id;
    if (!this._tickerSubs.has(remote_id)) return;
    this._tickerSubs.delete(remote_id);
    if (this._isConnected) {
      this._sendUnsubTicker(remote_id);
    }
  }

  subscribeTrades(market) {
    this._subscribe(market, this._tradeSubs, this._sendSubTrades.bind(this));
  }

  unsubscribeTrades(market) {
    this._unsubscribe(market, this._tradeSubs, this._sendUnsubTrades.bind(this));
  }

  subscribeCandles(market) {
    this._subscribe(market, this._candleSubs, this._sendSubCandles.bind(this));
  }

  unsubscribeCandles(market) {
    this._unsubscribe(market, this._candleSubs, this._sendUnsubCandles.bind(this));
  }

  subscribeLevel2Updates(market) {
    this._subscribe(market, this._level2UpdateSubs, this._sendSubLevel2Updates.bind(this));
  }

  unsubscribeLevel2Updates(market) {
    this._unsubscribe(market, this._level2UpdateSubs, this._sendUnsubLevel2Updates.bind(this));
  }

  ////////////////////////////////////
  // PROTECTED

  _resetSubCount() {
    this._subCount = {};
  }

  _subscribe(market, map, subFn) {
    this._connect();
    let remote_id = market.id;

    if (!map.has(remote_id)) {
      map.set(remote_id, market);

      if (this._isConnected) {
        subFn(remote_id, market);
      }
    }
  }

  _unsubscribe(market, map, unsubFn) {
    let remote_id = market.id;
    if (map.has(remote_id)) {
      map.delete(remote_id);

      if (this._isConnected) {
        unsubFn(remote_id, market);
      }
    }
  }

  _sendSubTickers() {
    if (this._tickerConnected) return;
    this._wss.call("c3", "Subscribe", ["market_summaries"]).done(err => {
      if (err) return this.emit("error", err);
      else this._tickerConnected = true;
    });
  }

  _sendUnsubTicker() {
    // no-op
  }

  _sendSubTrades(remote_id) {
    this._wss.call("c3", "Subscribe", [`trade_${remote_id}`]).done(err => {
      if (err) return this.emit("error", err);
    });
  }

  _sendUnsubTrades(remote_id) {
    this._wss.call("c3", "Unsubscribe", [`trade_${remote_id}`]).done(err => {
      if (err) return this.emit("error", err);
    });
  }

  _sendSubCandles(remote_id) {
    this._wss
      .call("c3", "Subscribe", [`candle_${remote_id}_${candlePeriod(this.candlePeriod)}`])
      .done(err => {
        if (err) return this.emit("error", err);
      });
  }

  _sendUnsubCandles(remote_id) {
    this._wss
      .call("c3", "Unsubscribe", [`candle_${remote_id}_${candlePeriod(this.candlePeriod)}`])
      .done(err => {
        if (err) return this.emit("error", err);
      });
  }

  _sendSubLevel2Updates(remote_id, market) {
    this._requestLevel2Snapshot(market);
    this._wss.call("c3", "Subscribe", [`orderbook_${remote_id}_${this.orderBookDepth}`]);
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.call("c3", "Unsubscribe", [`orderbook_${remote_id}_${this.orderBookDepth}`]);
  }

  async _connect() {
    // ignore wss creation is we already are connected
    if (this._wss) return;

    let wss = (this._wss = new turdr.client(
      "wss://socket-v3.bittrex.com/signalr", // service url
      ["c3"], // hubs
      undefined, // disable reconnection
      true // wait till .start() called
    ));

    wss.serviceHandlers = {
      bindingError: err => this.emit("error", err),
      connectFailed: () => this.emit("closed"),
      connected: this._onConnected.bind(this),
      connectionLost: () => this.emit("closed"),
      disconnected: this._onDisconnected.bind(this),
      onerror: err => this.emit("error", err),
      messageReceived: this._onMessage.bind(this),
      reconnecting: () => true, // disables reconnection
    };

    wss.start();
  }

  _onConnected() {
    clearTimeout(this._reconnectHandle);
    this._resetSubCount();
    this._tickerConnected = false;
    this._isConnected = true;
    this.emit("connected");
    for (let [marketSymbol, market] of this._tickerSubs) {
      this._sendSubTickers(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._tradeSubs) {
      this._sendSubTrades(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._candleSubs) {
      this._sendSubCandles(marketSymbol, market);
    }
    for (let [marketSymbol, market] of this._level2UpdateSubs) {
      this._sendSubLevel2Updates(marketSymbol, market);
    }
    this._watcher.start();
  }

  _onDisconnected() {
    this._isConnected = false;
    if (!this._finalClosing) {
      clearTimeout(this._reconnectHandle);
      this._watcher.stop();
      this.emit("disconnected");
      this._reconnectHandle = setTimeout(() => this.reconnect(false), this._retryTimeoutMs);
    }
  }

  _onMessage(raw) {
    try {
      if (!raw.utf8Data) return;

      raw = JSON.parse(raw.utf8Data);

      if (!raw.M) return;

      for (let msg of raw.M) {
        if (msg.M === "marketSummaries") {
          for (let a of msg.A) {
            zlib.inflateRaw(Buffer.from(a, "base64"), this._processTickers);
          }
        }

        if (msg.M === "trade") {
          for (let a of msg.A) {
            zlib.inflateRaw(Buffer.from(a, "base64"), this._processTrades);
          }
        }

        if (msg.M === "candle") {
          for (let a of msg.A) {
            zlib.inflateRaw(Buffer.from(a, "base64"), this._processCandles);
          }
        }

        if (msg.M === "orderBook") {
          for (let a of msg.A) {
            zlib.inflateRaw(Buffer.from(a, "base64"), this._processLevel2Update);
          }
        }
      }
    } catch (ex) {
      this.emit("error", ex);
    }
  }

  /**
   {
      "sequence": 3584000,
      "deltas": [
        {
          symbol: 'BTC-USDT',
          high: '12448.02615735',
          low: '11773.32163568',
          volume: '640.86060471',
          quoteVolume: '7714634.67704918',
          percentChange: '3.98',
          updatedAt: '2020-08-17T20:16:27.617Z'
        }
      ]
    }
   */
  _processTickers(err, raw) {
    if (err) {
      this.emit("error", err);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (ex) {
      this.emit("error", ex);
      return;
    }

    for (let datum of msg.deltas) {
      let market = this._tickerSubs.get(datum.symbol);
      if (!market) continue;

      let ticker = this._constructTicker(datum, market);
      this.emit("ticker", ticker, market);
    }
  }

  _constructTicker(msg, market) {
    let { high, low, volume, quoteVolume, percentChange, updatedAt } = msg;
    return new Ticker({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestamp: moment.utc(updatedAt).valueOf(),
      last: undefined,
      open: undefined,
      high: high,
      low: low,
      volume: volume,
      quoteVolume: quoteVolume,
      change: undefined,
      changePercent: percentChange,
      bid: undefined,
      ask: undefined,
    });
  }

  /**
   {
      deltas: [
        {
          id: 'edacd990-7c5f-4c75-8a66-ce0a71093b3c',
          executedAt: '2020-08-17T20:36:39.96Z',
          quantity: '0.00714818',
          rate: '12301.34800000',
          takerSide: 'BUY'
        }
      ],
      sequence: 18344,
      marketSymbol: 'BTC-USDT'
    }
   */
  _processTrades(err, raw) {
    if (err) {
      this.emit("error", err);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (ex) {
      this.emit("error", ex);
      return;
    }

    let market = this._tradeSubs.get(msg.marketSymbol);
    if (!market) return;

    for (let datum of msg.deltas) {
      let trade = this._constructTrade(datum, market);
      this.emit("trade", trade, market);
    }
  }

  _constructTrade(msg, market) {
    let tradeId = msg.id;
    let unix = moment.utc(msg.executedAt).valueOf();
    let price = msg.rate;
    let amount = msg.quantity;
    let side = msg.takerSide === "BUY" ? "buy" : "sell";
    return new Trade({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      tradeId,
      unix,
      side,
      price,
      amount,
    });
  }

  /**
   {
      sequence: 10808,
      marketSymbol: 'BTC-USDT',
      interval: 'MINUTE_1',
      delta: {
        startsAt: '2020-08-17T20:47:00Z',
        open: '12311.59599999',
        high: '12311.59599999',
        low: '12301.57150000',
        close: '12301.57150000',
        volume: '1.65120614',
        quoteVolume: '20319.96359337'
      }
    }
   */
  _processCandles(err, raw) {
    if (err) {
      this.emit("error", err);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (ex) {
      this.emit("error", ex);
      return;
    }

    let market = this._candleSubs.get(msg.marketSymbol);
    if (!market) return;

    let candle = this._constructCandle(msg.delta, market);
    this.emit("candle", candle, market);
  }

  _constructCandle(msg) {
    return new Candle(
      moment.utc(msg.startsAt).valueOf(),
      msg.open,
      msg.high,
      msg.low,
      msg.close,
      msg.volume
    );
  }

  /**
   {
      marketSymbol: 'BTC-USDT',
      depth: 500,
      sequence: 545851,
      bidDeltas: [
        { quantity: '0', rate: '12338.47320003' },
        { quantity: '0.01654433', rate: '10800.62000000' }
      ],
      askDeltas: []
    }
   */
  _processLevel2Update(err, raw) {
    if (err) {
      this.emit("error", err);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (ex) {
      this.emit("error", ex);
      return;
    }

    let market = this._level2UpdateSubs.get(msg.marketSymbol);
    if (!market) return;

    let update = this._constructLevel2Update(msg, market);
    this.emit("l2update", update, market);
  }

  _constructLevel2Update(msg, market) {
    let sequenceId = msg.sequence;
    let depth = msg.depth;
    let bids = msg.bidDeltas.map(p => new Level2Point(p.rate, p.quantity, undefined, { depth }));
    let asks = msg.askDeltas.map(p => new Level2Point(p.rate, p.quantity, undefined, { depth }));
    return new Level2Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId,
      asks,
      bids,
    });
  }

  async _requestLevel2Snapshot(market) {
    let failed = false;
    try {
      let remote_id = market.id;
      let uri = `https://api.bittrex.com/v3/markets/${remote_id}/orderbook?depth=${this.orderBookDepth}`;
      let raw = await https.get(uri);
      let asks = raw.ask.map(p => new Level2Point(p.rate, p.quantity));
      let bids = raw.bid.map(p => new Level2Point(p.rate, p.quantity));
      let snapshot = new Level2Snapshot({
        exchange: this._name,
        base: market.base,
        quote: market.quote,
        asks,
        bids,
      });
      this.emit("l2snapshot", snapshot, market);
    } catch (ex) {
      this.emit("error", ex);
      failed = true;
    } finally {
      if (failed) this._requestLevel2Snapshot(market);
    }
  }
}

function candlePeriod(period) {
  switch (period) {
    case CandlePeriod._1m:
      return "MINUTE_1";
    case CandlePeriod._5m:
      return "MINUTE_5";
    case CandlePeriod._1h:
      return "HOUR_1";
    case CandlePeriod._1d:
      return "DAY_1";
  }
}

module.exports = BittrexClient;
