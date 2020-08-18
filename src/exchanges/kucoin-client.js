const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Candle = require("../candle");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const Level3Update = require("../level3-update");
const Level3Snapshot = require("../level3-snapshot");
const https = require("../https");
const UUID = require("uuid/v4");
const { CandlePeriod } = require("../enums");
const semaphore = require("semaphore");
const { throttle } = require("../flowcontrol/throttle");
const { batch } = require("../flowcontrol/batch");
const Level3Point = require("../level3-point");

class KucoinClient extends BasicClient {
  /**
   * Kucoin client has a hard limit of 100 subscriptions per socket connection.
   * When more than 100 subscriptions are made on a single socket it will generate
   * an error that says "509: exceed max subscription count limitation of 100 per session".
   * To work around this will require creating multiple clients if you makem ore than 100
   * subscriptions.
   */
  constructor({
    wssPath,
    watcherMs,
    socketBatchSize = 100,
    socketThrottleMs = 100
  } = {}) {
    super(wssPath, "KuCoin", undefined, watcherMs);

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = true;
    this.candlePeriod = CandlePeriod._1m;
    this._pingIntervalTime = 50000;
    this._throttleMs = 100;
    this.restRequestDelayMs = 250;
    this._requestLevel2Snapshot = throttle(
      this._requestLevel2Snapshot.bind(this),
      this._throttleMs
    );

    this._sendSubCandles = batch(this._sendSubCandles.bind(this), socketBatchSize);
    this._sendUnsubCandles = batch(this._sendUnsubCandles.bind(this), socketBatchSize);
    this._sendMessage = throttle(this._sendMessage.bind(this), socketThrottleMs);
  }

  _beforeConnect() {
    this._wss.prependListener("connected", this._resetSemaphore.bind(this));
    this._wss.on("connected", this._startPing.bind(this));
    this._wss.on("disconnected", this._stopPing.bind(this));
    this._wss.on("closed", this._stopPing.bind(this));
  }

  _resetSemaphore() {
    this._sem = semaphore(1);
    this._httpsem = semaphore(1);
  }

  _startPing() {
    clearInterval(this._pingInterval);
    this._pingInterval = setInterval(this._sendPing.bind(this), this._pingIntervalTime);
  }

  _stopPing() {
    clearInterval(this._pingInterval);
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "ping",
        })
      );
    }
  }

  /**
   * Kucoin requires a token that is obtained from a REST endpoint. We make the synchronous
   * _connect method create a temporary _wss instance so that subsequent calls to _connect
   * are idempotent and only a single socket connection is created. Then the _connectAsync
   * call is performed that does the REST token fetching and the connection.
   */
  _connect() {
    if (!this._wss) {
      this._wss = { status: "connecting" };
      this._connectAsync();
    }
  }

  _onClosing() {
    this._sendSubCandles.cancel();
    this._sendUnsubCandles.cancel();
    this._sendMessage.cancel();
    this._requestLevel2Snapshot.cancel();
    super._onClosing();
  }

  async _connectAsync() {
    try {
      let raw = await https.post("https://openapi-v2.kucoin.com/api/v1/bullet-public");
      if (raw.data && raw.data.token) {
        const { token, instanceServers } = raw.data;
        const { endpoint, pingInterval } = instanceServers[0];
        this._connectId = UUID();
        this._pingIntervalTime = pingInterval;
        this._wssPath = `${endpoint}?token=${token}&connectId=${this._connectId}`;
        this._wss = this._wssFactory(this._wssPath);
        this._wss.on("error", this._onError.bind(this));
        this._wss.on("connecting", this._onConnecting.bind(this));
        this._wss.on("connected", this._onConnected.bind(this));
        this._wss.on("disconnected", this._onDisconnected.bind(this));
        this._wss.on("closing", this._onClosing.bind(this));
        this._wss.on("closed", this._onClosed.bind(this));
        this._wss.on("message", msg => {
          try {
            this._onMessage(msg);
          } catch (ex) {
            this._onError(ex);
          }
        });
        if (this._beforeConnect) this._beforeConnect();
        this._wss.connect();
      }
    } catch (ex) {
      this._onError(ex);
    }
  }

  _sendSubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "subscribe",
          topic: "/market/snapshot:" + remote_id,
          privateChannel: false,
          response: true,
        })
      );
    });
  }

  _sendUnsubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "unsubscribe",
          topic: "/market/snapshot:" + remote_id,
          privateChannel: false,
          response: true,
        })
      );
    });
  }

  _sendSubTrades(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "subscribe",
          topic: "/market/match:" + remote_id,
          privateChannel: false,
          response: true,
        })
      );
    });
  }

  _sendUnsubTrades(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "unsubscribe",
          topic: "/market/match:" + remote_id,
          privateChannel: false,
          response: true,
        })
      );
    });
  }

  _sendSubCandles(args) {
    const pairs = args.map(remote_id => {
      return remote_id[0] + "_" + candlePeriod(this.candlePeriod);
    });
    this._sendMessage(
      JSON.stringify({
        id: new Date().getTime(),
        type: "subscribe",
        topic: "/market/candles:" + pairs.join(","),
        privateChannel: false,
        response: true,
      })
    );
  }

  _sendUnsubCandles(args) {
    const pairs = args.map(remote_id => {
      return remote_id[0] + "_" + candlePeriod(this.candlePeriod);
    });
    this._sendMessage(
      JSON.stringify({
        id: new Date().getTime(),
        type: "unsubscribe",
        topic: "/market/candles:" + pairs.join(","),
        privateChannel: false,
        response: true,
      })
    );
  }

  _sendMessage(msg) {
    this._sem.take(() => {
      this._wss.send(msg);
    });
  }

  _sendSubLevel2Updates(remote_id) {
    this._sem.take(() => {
      let market = this._level2UpdateSubs.get(remote_id);
      this._requestLevel2Snapshot(market);

      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "subscribe",
          topic: "/market/level2:" + remote_id,
          response: true,
        })
      );
    });
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "unsubscribe",
          topic: "/market/level2:" + remote_id,
          response: true,
        })
      );
    });
  }

  _sendSubLevel3Updates(remote_id) {
    this._sem.take(() => {
      let market = this._level3UpdateSubs.get(remote_id);
      this._requestLevel3Snapshot(market);

      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "subscribe",
          topic: "/spotMarket/level3:" + remote_id,
          response: true,
        })
      );
    });
  }

  _sendUnsubLevel3Updates(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "unsubscribe",
          topic: "/spotMarket/level3:" + remote_id,
          response: true,
        })
      );
    });
  }

  _onMessage(raw) {
    let replaced = raw.replace(/:(\d+\.{0,1}\d+)(,|\})/g, ':"$1"$2');
    try {
      let msgs = JSON.parse(replaced);

      if (Array.isArray(msgs)) {
        for (let msg of msgs) {
          this._processMessage(msg);
        }
      } else {
        this._processMessage(msgs);
      }
    } catch (ex) {
      this._onError(ex);
    }
  }

  _processMessage(msg) {
    if (msg.type === "ack" || msg.type === "error") {
      setTimeout(() => this._sem.leave(), this._throttleMs);
    }

    if (msg.type === "error") {
      let err = new Error(msg.data);
      err.msg = msg;
      this._onError(err);
      return;
    }

    // trades
    if (msg.subject === "trade.l3match") {
      this._processTrades(msg);
      return;
    }

    // candles
    if (msg.subject.includes("trade.candles")) { // trade.candles.update + trade.candles.add
      this._processCandles(msg);
      return;
    }

    // tickers
    if (msg.subject === "trade.snapshot") {
      this._processTicker(msg);
      return;
    }

    // l2 updates
    if (msg.subject === "trade.l2update") {
      this._processL2Update(msg);
      return;
    }

    // l3 received
    if (msg.subject === "received") {
      this._processL3UpdateReceived(msg);
      return;
    }

    // l3 open
    if (msg.subject === "open") {
      this._processL3UpdateOpen(msg);
      return;
    }

    // l3 done
    if (msg.subject === "done") {
      this._processL3UpdateDone(msg);
      return;
    }

    // l3 match
    if (msg.subject === "match") {
      this._processL3UpdateMatch(msg);
      return;
    }

    // l3 change
    if (msg.subject === "update") {
      this._processL3UpdateUpdate(msg);
      return;
    }
  }

  _processTrades(msg) {
    let { symbol, time, side, size, price, tradeId, makerOrderId, takerOrderId } = msg.data;
    let market = this._tradeSubs.get(symbol);
    if (!market) {
      return;
    }

    if (time.length === 19) {
      time = time.substring(0, 13);
    }

    let trade = new Trade({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      tradeId: tradeId,
      side: side,
      unix: parseInt(time),
      price: price,
      amount: size,
      buyOrderId: side === "buy" ? makerOrderId : takerOrderId,
      sellOrderId: side === "sell" ? makerOrderId : takerOrderId,
    });

    this.emit("trade", trade, market);
  }

  /**
    {
        "type":"message",
        "topic":"/market/candles:BTC-USDT_1hour",
        "subject":"trade.candles.update",
        "data":{

            "symbol":"BTC-USDT",    // symbol
            "candles":[

                "1589968800",   // Start time of the candle cycle
                "9786.9",       // open price
                "9740.8",       // close price
                "9806.1",       // high price
                "9732",         // low price
                "27.45649579",  // Transaction volume
                "268280.09830877"   // Transaction amount
            ],
            "time":1589970010253893337  // now（us）
        }
    }
   */
  _processCandles(msg) {
    let { symbol, candles } = msg.data;
    let market = this._candleSubs.get(symbol);
    if (!market) return;

    const result = new Candle(
      Number(candles[0] * 1000),
      candles[1],
      candles[3],
      candles[4],
      candles[2],
      candles[5]
    );
    this.emit("candle", result, market);
  }

  _processTicker(msg) {
    let {
      symbol,
      high,
      low,
      datetime,
      vol,
      lastTradedPrice,
      changePrice,
      changeRate,
      open,
      sell,
      buy,
    } = msg.data.data;
    let market = this._tickerSubs.get(symbol);

    if (!market) {
      return;
    }

    let ticker = new Ticker({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      timestamp: parseFloat(datetime),
      last: lastTradedPrice,
      open: open,
      high: high,
      low: low,
      volume: vol,
      change: changePrice.toFixed ? changePrice.toFixed(8) : changePrice,
      changePercent: changeRate.toFixed ? changeRate.toFixed(2) : changeRate,
      bid: buy,
      ask: sell,
      bidVolume: undefined,
      quoteVolume: undefined,
      askVolume: undefined,
    });

    this.emit("ticker", ticker, market);
  }

  /**
    {
      "data":{
        "sequenceStart":"1584724386150",
        "symbol":"BTC-USDT",
        "changes":{
          "asks":[
            ["9642.7","0.386","1584724386150"]
          ],
          "bids":[]
        },
        "sequenceEnd":"1584724386150"
      },
      "subject":"trade.l2update",
      "topic":"/market/level2:BTC-USDT",
      "type":"message"
    }
   */
  _processL2Update(msg) {
    const { symbol, changes, sequenceStart, sequenceEnd } = msg.data;
    let market = this._level2UpdateSubs.get(symbol);

    if (!market) {
      return;
    }

    let asks = changes.asks.map(p => new Level2Point(p[0], p[1]));
    let bids = changes.bids.map(p => new Level2Point(p[0], p[1]));
    let lastSequenceId = Number(sequenceEnd);
    let l2Update = new Level2Update({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      sequenceId: Number(sequenceStart),
      sequenceLast: lastSequenceId, // deprecated, to be removed
      lastSequenceId,
      asks,
      bids,
    });
    this.emit("l2update", l2Update, market);
  }

  /**
   {
      "code": "200000",
      "data": {
        "sequence": "1584724519811",
        "asks": [
          [
            "9631.9",
            "1.62256573"
          ],
          [
            "9632",
            "0.00000001"
          ]
        ],
        "bids": [
          [
            "9631.8",
            "0.19411805"
          ],
          [
            "9631.6",
            "0.00094623"
          ]
        ],
        "time": 1591469595966
      }
    }
   */
  async _requestLevel2Snapshot(market) {
    try {
      let remote_id = market.id;
      let uri = `https://api.kucoin.com/api/v1/market/orderbook/level2_100?symbol=${remote_id}`;
      let raw = await https.get(uri);

      let asks = raw.data.asks.map(p => new Level2Point(p[0], p[1]));
      let bids = raw.data.bids.map(p => new Level2Point(p[0], p[1]));
      let snapshot = new Level2Snapshot({
        exchange: "KuCoin",
        sequenceId: Number(raw.data.sequence),
        base: market.base,
        quote: market.quote,
        asks,
        bids,
      });
      this.emit("l2snapshot", snapshot, market);
    } catch (ex) {
      this.emit("error", ex);
      this._requestLevel2Snapshot(market);
    }
  }

  /**
   RECEIVED - This message type is really for informational purposes and
   does not include a side or price. Similar to the done message below
   we will include a psuedo-point with zeroedp price and amount to
   maintain consistency with other implementations.
   {
      "data": {
        "symbol": "BTC-USDT",
        "sequence": "1594781753800",
        "orderId": "5f3aa0c724d57500070d36e7",
        "clientOid": "cef1156e5f928d0e046a67891cdb780d",
        "ts": "1597677767948119917"
      },
      "subject": "received",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
  */
  _processL3UpdateReceived(msg) {
    const { symbol, sequence, orderId, clientOid, ts } = msg.data;

    let market = this._level3UpdateSubs.get(symbol);
    if (!market) return;

    let point = new Level3Point(orderId, "0", "0", { type: msg.subject, clientOid, ts });

    let update = new Level3Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs: Math.trunc(Number(ts) / 1e6),
      sequenceId: Number(sequence),
      asks: [point],
      bids: [point],
    });
    this.emit("l3update", update, market);
  }

  /**
    OPEN
    {
      "data": {
        "symbol": "BTC-USDT",
        "sequence": "1594781800484",
        "side": "buy",
        "orderTime": "1597678002842139731",
        "size": "0.65898942",
        "orderId": "5f3aa1b2b6aeb200072bd6d8",
        "price": "12139.8",
        "ts": "1597678002842139731"
      },
      "subject": "open",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
   */
  _processL3UpdateOpen(msg) {
    const { symbol, sequence, side, orderTime, size, orderId, price, ts } = msg.data;

    let market = this._level3UpdateSubs.get(symbol);
    if (!market) return;

    let asks = [];
    let bids = [];

    let point = new Level3Point(orderId, price, size, { type: msg.subject, orderTime, ts });
    if (side === "buy") bids.push(point);
    else asks.push(point);

    let update = new Level3Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: Number(sequence),
      timestampMs: Math.trunc(Number(ts) / 1e6),
      asks,
      bids,
    });
    this.emit("l3update", update, market);
  }

  /**
    DONE - because done does not include price,size, or side of book,
    we will create a zeroed point on both sides of the book. This keeps
    consistency with other order books that always have a point.

    {
      "data": {
        "symbol": "BTC-USDT",
        "reason": "canceled",
        "sequence": "1594781816444",
        "orderId": "5f3aa1f3b640150007baf5d6",
        "ts": "1597678072795057282"
      },
      "subject": "done",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
   */
  _processL3UpdateDone(msg) {
    const { symbol, sequence, orderId, reason, ts } = msg.data;

    let market = this._level3UpdateSubs.get(symbol);
    if (!market) return;

    let point = new Level3Point(orderId, "0", "0", { type: msg.subject, reason, ts });

    let update = new Level3Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: Number(sequence),
      timestampMs: Math.trunc(Number(ts) / 1e6),
      asks: [point],
      bids: [point],
    });
    this.emit("l3update", update, market);
  }

  /**
   MATCH - for the sake of the update, we will follow with the
   information that is updated in the orderbook, that is the maker. In
   this case, the remainSize is the value that should be adjusted
   for the maker's order.
   {
      "data": {
        "symbol": "BTC-USDT",
        "sequence": "1594781824886",
        "side": "sell",
        "size": "0.04541835",
        "price": "12161.1",
        "takerOrderId": "5f3aa220be5dd1000815506e",
        "makerOrderId": "5f3aa21db6aeb200072ce502",
        "tradeId": "5f3aa22078577835017d3de2",
        "remainSize": "1.44964657",
        "ts": "1597678112828040864"
      },
      "subject": "match",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
   */
  _processL3UpdateMatch(msg) {
    const {
      symbol,
      sequence,
      side,
      price,
      size,
      remainSize,
      takerOrderId,
      makerOrderId,
      tradeId,
      ts,
    } = msg.data;

    let market = this._level3UpdateSubs.get(symbol);
    if (!market) return;

    let asks = [];
    let bids = [];

    let point = new Level3Point(makerOrderId, "0", remainSize, {
      type: msg.subject,
      remainSize,
      takerOrderId,
      makerOrderId,
      tradeId,
      tradePrice: price,
      tradeSize: size,
      ts,
    });

    // The update is from the perspective of the maker. The side is side
    // of the taker, so we need to reverse it. That is a buy should
    // put the update on the ask side and a sell should put the update
    // on the bid side.
    if (side === "buy") asks.push(point);
    else bids.push(point);

    let update = new Level3Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: Number(sequence),
      timestampMs: Math.trunc(Number(ts) / 1e6),
      asks,
      bids,
    });

    this.emit("l3update", update, market);
  }

  /**
   CHANGE - because change does not include the side, we again duplicate
   points in the asks and bids. The price is also not inclued and is
   zeroed to maintain consistency with the remainder of the library
   {
      "data": {
        "symbol": "BTC-USDT",
        "sequence": "1594781878279",
        "size": "0.0087306",
        "orderId": "5f3aa2d2d5f3da0007802966",
        "ts": "1597678290249785626"
      },
      "subject": "update",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
   */
  _processL3UpdateUpdate(msg) {
    let { symbol, sequence, orderId, size, ts } = msg;
    let market = this._level3UpdateSubs.get(symbol);
    if (!market) return;

    let point = new Level3Point(orderId, "0", size, { type: msg.subject, ts });
    let update = Level3Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: Number(sequence),
      timestampMs: Math.trunc(Number(ts) / 1e6),
      asks: [point],
      bids: [point],
    });
    this.emit("l3update", update, market);
  }

  async _requestLevel3Snapshot(market) {
    try {
      let remote_id = market.id;
      let uri = `https://api.kucoin.com/api/v1/market/orderbook/level3?symbol=${remote_id}`;
      let raw = await https.get(uri);

      let timestampMs = raw.data.time;
      let sequenceId = Number(raw.data.sequence);

      let asks = raw.data.asks.map(
        p =>
          new Level3Point(p[0], p[1], p[2], {
            orderTime: p[3],
            timestampMs: Math.trunc(Number(p[3]) / 1e6),
          })
      );
      let bids = raw.data.bids.map(
        p =>
          new Level3Point(p[0], p[1], p[2], {
            orderTime: p[3],
            timestampMs: Math.trunc(Number(p[3]) / 1e6),
          })
      );
      let snapshot = new Level3Snapshot({
        exchange: this._name,
        base: market.base,
        quote: market.quote,
        sequenceId,
        timestampMs,
        asks,
        bids,
      });
      this.emit("l3snapshot", snapshot, market);
    } catch (ex) {
      this.emit("error", ex);
      this._requestLevel3Snapshot(market);
    }
  }
}

function candlePeriod(period) {
  switch (period) {
    case CandlePeriod._1m:
      return "1min";
    case CandlePeriod._3m:
      return "3min";
    case CandlePeriod._15m:
      return "15min";
    case CandlePeriod._30m:
      return "30min";
    case CandlePeriod._1h:
      return "1hour";
    case CandlePeriod._2h:
      return "2hour";
    case CandlePeriod._4h:
      return "4hour";
    case CandlePeriod._6h:
      return "6hour";
    case CandlePeriod._8h:
      return "8hour";
    case CandlePeriod._12h:
      return "12hour";
    case CandlePeriod._1d:
      return "1day";
    case CandlePeriod._1w:
      return "1week";
  }
}

module.exports = KucoinClient;
