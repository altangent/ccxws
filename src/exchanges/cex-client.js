const crypto = require("crypto");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Candle = require("../candle");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const BasicMultiClient = require("../basic-multiclient");
const BasicClient = require("../basic-client");
const Watcher = require("../watcher");
const { CandlePeriod } = require("../enums");

function createSignature(timestamp, apiKey, apiSecret) {
  var hmac = crypto.createHmac("sha256", apiSecret);
  hmac.update(timestamp + apiKey);
  return hmac.digest("hex");
}

function createAuthToken(apiKey, apiSecret) {
  var timestamp = Math.floor(Date.now() / 1000);
  return {
    key: apiKey,
    signature: createSignature(timestamp, apiKey, apiSecret),
    timestamp,
  };
}

const multiplier = {
  ADA: 1e6,
  ATOM: 1e6,
  BAT: 1e6,
  GAS: 1e8,
  NEO: 1e6,
  ONT: 1e6,
  ONG: 1e6,
  MATIC: 1e6,
  LINK: 1e6,
  XTZ: 1e6,
  BCH: 1e8,
  BTC: 1e8,
  BTG: 1e8,
  BTT: 1e6,
  DASH: 1e8,
  ETH: 1e6,
  GUSD: 1e2,
  LTC: 1e8,
  MHC: 1e6,
  OMG: 1e6,
  TRX: 1e6,
  XLM: 1e7,
  XRP: 1e6,
  ZEC: 1e8,
};

function formatAmount(amount, symbol) {
  return (parseInt(amount) / multiplier[symbol]).toFixed(8);
}

class CexClient extends BasicMultiClient {
  /**
   * Creates a new CEX.io client using the supplied credentials
   * @param {{ apiKey: string, apiSecret: string }} options
   */
  constructor(options = {}) {
    super();
    this._clients = new Map();

    this._name = "CEX_MULTI";
    this.options = options;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = true;
    this.candlePeriod = CandlePeriod._1m;
  }

  _createBasicClient(clientArgs) {
    return new SingleCexClient({
      ...this.options,
      market: clientArgs.market,
      parent: this,
    });
  }
}

class SingleCexClient extends BasicClient {
  constructor({
    wssPath = "wss://ws.cex.io/ws",
    watcherMs = 900 * 1000,
    apiKey,
    apiSecret,
    market,
    parent,
  }) {
    super(wssPath, "CEX", undefined, watcherMs);
    this._watcher = new Watcher(this, watcherMs);
    this.auth = { apiKey, apiSecret };
    this.market = market;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = true;
    this.authorized = false;
    this.parent = parent;
  }

  get candlePeriod() {
    return this.parent.candlePeriod;
  }

  /**
   * This method is fired anytime the socket is opened, whether
   * the first time, or any subsequent reconnects.
   * Since this is an authenticated feed, we first send an authenticate
   * request, and the normal subscriptions happen after authentication has
   * completed in the _onAuthorized method.
   */
  _onConnected() {
    this._sendAuthorizeRequest();
  }

  /**
   * Trigger after an authorization packet has been successfully received.
   * This code triggers the usual _onConnected code afterwards.
   */
  _onAuthorized() {
    this.authorized = true;
    this.emit("authorized");
    super._onConnected();
  }

  _sendAuthorizeRequest() {
    this._wss.send(
      JSON.stringify({
        e: "auth",
        auth: createAuthToken(this.auth.apiKey, this.auth.apiSecret),
      })
    );
  }

  _sendPong() {
    if (this._wss) {
      this._wss.send(JSON.stringify({ e: "pong" }));
    }
  }

  _sendSubTicker() {
    if (!this.authorized) return;
    this._wss.send(
      JSON.stringify({
        e: "subscribe",
        rooms: ["tickers"],
      })
    );
  }

  _sendUnsubTicker() {}

  _sendSubTrades(remote_id) {
    if (!this.authorized) return;
    this._wss.send(
      JSON.stringify({
        e: "subscribe",
        rooms: [`pair-${remote_id.replace("/", "-")}`],
      })
    );
  }

  _sendUnsubTrades() {}

  _sendSubCandles(remote_id) {
    if (!this.authorized) return;
    this._wss.send(
      JSON.stringify({
        e: "init-ohlcv",
        i: candlePeriod(this.candlePeriod),
        rooms: [`pair-${remote_id.replace("/", "-")}`],
      })
    );
  }

  _sendUnsubCandles() {}

  _sendSubLevel2Snapshots(remote_id) {
    if (!this.authorized) return;
    this._wss.send(
      JSON.stringify({
        e: "subscribe",
        rooms: [`pair-${remote_id.replace("/", "-")}`],
      })
    );
  }

  _sendUnsubLevel2Snapshots() {}

  _onMessage(raw) {
    let message = JSON.parse(raw);
    let { e, data } = message;

    if (e === "ping") {
      this._sendPong();
      return;
    }

    if (e === "subscribe") {
      if (message.error) {
        throw new Error(`CEX error: ${JSON.stringify(message)}`);
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
      let marketId = `${data.symbol1}/${data.symbol2}`;
      let market = this._tickerSubs.get(marketId);
      if (!market) return;

      let ticker = this._constructTicker(data, market);
      this.emit("ticker", ticker, market);
      return;
    }

    if (e === "md") {
      let marketId = data.pair.replace(":", "/");
      let market = this._level2SnapshotSubs.get(marketId);
      if (!market) return;

      let result = this._constructevel2Snapshot(data, market);
      this.emit("l2snapshot", result, market);
      return;
    }

    if (e === "history") {
      let marketId = this.market.id;
      let market = this._tradeSubs.get(marketId);
      if (!market) return;

      // sell/buy:timestamp_ms:amount:price:transaction_id
      for (let rawTrade of data.reverse()) {
        let tradeData = rawTrade.split(":");
        let trade = this._constructTrade(tradeData, market);
        this.emit("trade", trade, market);
      }
      return;
    }

    if (e === "history-update") {
      let marketId = this.market.id;
      let market = this._tradeSubs.get(marketId);
      if (this._tradeSubs.has(marketId)) {
        for (let rawTrade of data) {
          let trade = this._constructTrade(rawTrade, market);
          this.emit("trade", trade, market);
        }
        return;
      }
    }

    // ohlcv{period} - why the F*** are there three styles of candles???
    if (e === `ohlcv${candlePeriod(this.candlePeriod)}`) {
      let marketId = message.data.pair.replace(":", "/");
      let market = this._candleSubs.get(marketId);
      if (!market) return;

      let candle = this._constructCandle(message.data, market);
      this.emit("candle", candle, market);
      return;
    }
  }

  _constructTicker(data, market) {
    // {"e":"tick","data":{"symbol1":"BTC","symbol2":"USD","price":"4244.4","open24":"4248.4","volume":"935.58669239"}}
    let { open24, price, volume } = data;
    let change = parseFloat(price) - parseFloat(open24);
    let changePercent =
      open24 !== 0 ? ((parseFloat(price) - parseFloat(open24)) / parseFloat(open24)) * 100 : 0;

    return new Ticker({
      exchange: "CEX",
      base: market.base,
      quote: market.quote,
      timestamp: Date.now(),
      last: price,
      open: open24,
      volume: volume,
      change: change.toFixed(8),
      changePercent: changePercent.toFixed(8),
    });
  }

  _constructevel2Snapshot(msg, market) {
    let asks = msg.sell.map(p => new Level2Point(p[0].toFixed(8), formatAmount(p[1], market.base)));
    let bids = msg.buy.map(p => new Level2Point(p[0].toFixed(8), formatAmount(p[1], market.base)));

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
      amount: formatAmount(amount, market.base),
      rawAmount: amount,
    });
  }

  /**
   {
      e: 'ohlcv1m',
      data: {
        pair: 'BTC:USD',
        time: '1597261140',
        o: '11566.8',
        h: '11566.8',
        l: '11566.8',
        c: '11566.8',
        v: 664142,
        d: 664142
      }
    }
   */
  _constructCandle(data) {
    const ms = Number(data.time) * 1000;
    return new Candle(ms, data.o, data.h, data.l, data.c, data.v.toFixed(8));
  }
}

function candlePeriod(period) {
  switch (period) {
    case CandlePeriod._1m:
      return "1m";
    case CandlePeriod._3m:
      return "3m";
    case CandlePeriod._5m:
      return "5m";
    case CandlePeriod._15m:
      return "15m";
    case CandlePeriod._30m:
      return "30m";
    case CandlePeriod._1h:
      return "1h";
    case CandlePeriod._2h:
      return "2h";
    case CandlePeriod._4h:
      return "4h";
    case CandlePeriod._6h:
      return "6h";
    case CandlePeriod._12h:
      return "12h";
    case CandlePeriod._1d:
      return "1d";
    case CandlePeriod._3d:
      return "3d";
    case CandlePeriod._1w:
      return "1w";
  }
}

module.exports = CexClient;
