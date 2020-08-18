const zlib = require("../zlib");
const https = require("../https");
const moment = require("moment");
const BasicClient = require("../basic-client");
const SmartWss = require("../smart-wss");
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
 *
 * This client uses SignalR and requires a custom connection strategy to
 * obtain a socket. Otherwise, things are relatively the same vs a
 * standard client.
 */
class BittrexClient extends BasicClient {
  constructor({ wssPath, watcherMs = 15000 } = {}) {
    super(wssPath, "Bittrex", undefined, watcherMs);

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;
    this.candlePeriod = CandlePeriod._1m;
    this.orderBookDepth = 500;

    this._subbedTickers = false;
    this._messageId = 0;
    this._processTickers = this._processTickers.bind(this);
    this._processTrades = this._processTrades.bind(this);
    this._processCandles = this._processCandles.bind(this);
    this._processLevel2Update = this._processLevel2Update.bind(this);
  }

  ////////////////////////////////////
  // PROTECTED

  _beforeConnect() {
    this._wss.on("connected", () => this._sendHeartbeat());
  }

  _beforeClose() {
    this._subbedTickers = false;
  }

  _sendHeartbeat() {
    this._wss.send(
      JSON.stringify({
        H: "c3",
        M: "Subscribe",
        A: [["heartbeat"]],
        I: ++this._messageId,
      })
    );
  }

  _sendSubTicker() {
    if (this._subbedTickers) return;
    this._subbedTickers = true;
    this._wss.send(
      JSON.stringify({
        H: "c3",
        M: "Subscribe",
        A: [["market_summaries"]],
        I: ++this._messageId,
      })
    );
  }

  _sendUnsubTicker() {
    // no-op
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        H: "c3",
        M: "Subscribe",
        A: [[`trade_${remote_id}`]],
        I: ++this._messageId,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        H: "c3",
        M: "Unsubscribe",
        A: [[`trade_${remote_id}`]],
        I: ++this._messageId,
      })
    );
  }

  _sendSubCandles(remote_id) {
    this._wss.send(
      JSON.stringify({
        H: "c3",
        M: "Subscribe",
        A: [[`candle_${remote_id}_${candlePeriod(this.candlePeriod)}`]],
        I: ++this._messageId,
      })
    );
  }

  _sendUnsubCandles(remote_id) {
    this._wss.send(
      JSON.stringify({
        H: "c3",
        M: "Unsubscribe",
        A: [[`candle_${remote_id}_${candlePeriod(this.candlePeriod)}`]],
        I: ++this._messageId,
      })
    );
  }

  _sendSubLevel2Updates(remote_id, market) {
    this._requestLevel2Snapshot(market);
    this._wss.send(
      JSON.stringify({
        H: "c3",
        M: "Subscribe",
        A: [[`orderbook_${remote_id}_${this.orderBookDepth}`]],
        I: ++this._messageId,
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        H: "c3",
        M: "Subscribe",
        A: [[`orderbook_${remote_id}_${this.orderBookDepth}`]],
        I: ++this._messageId,
      })
    );
  }

  /**
   * Requires connecting to SignalR which has a whole BS negotiation
   * to obtain a token, similar to Kucoin actually.
   */
  _connect() {
    if (!this._wss) {
      this._wss = { status: "connecting" };
      this._connectAsync();
    }
  }

  async _connectAsync() {
    try {
      let wssPath = this.wssPath;

      if (!wssPath) {
        let data = JSON.stringify([{ name: "c3" }]);
        let negotiations = await https.get(
          `https://socket-v3.bittrex.com/signalr/negotiate?connectionData=${data}&clientProtocol=1.5`
        );
        let token = encodeURIComponent(negotiations.ConnectionToken);
        wssPath = `wss://socket-v3.bittrex.com/signalr/connect?clientProtocol=1.5&transport=webSockets&connectionToken=${token}&connectionData=${data}&tid=10`;
      }

      let wss = new SmartWss(wssPath);
      this._wss = wss;

      wss.on("error", err => this.emit("error", err));
      wss.on("connecting", () => this.emit("connecting"));
      wss.on("connected", this._onConnected.bind(this));
      wss.on("disconnected", () => this.emit("disconnected"));
      wss.on("closing", () => this.emit("closing"));
      wss.on("closed", () => this.emit("closed"));
      wss.on("message", this._onMessage.bind(this));
      if (this._beforeConnect) this._beforeConnect();
      wss.connect();
    } catch (ex) {
      this._onError(ex);
    }
  }

  _onMessage(raw) {
    try {
      const fullMsg = JSON.parse(raw);

      // Handle responses
      // {"R":[{"Success":true,"ErrorCode":null},{"Success":true,"ErrorCode":null}],"I":1}
      if (fullMsg.R) {
        for (let msg of fullMsg.R) {
          if (!msg.Success) {
            this.emit("error", new Error("Subscription failed with error " + msg.ErrorCode));
          }
        }
      }

      // Handle messages
      if (!fullMsg.M) return;
      for (let msg of fullMsg.M) {
        if (msg.M === "heartbeat") {
          this._watcher.markAlive();
        }

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
