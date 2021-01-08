const BasicClient = require("../basic-client");
const BasicMultiClient = require("../basic-multiclient");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const moment = require("moment");

class GMOCoinClient extends BasicMultiClient {
  constructor(options = {}) {
    super();
    this.options = options;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
  }

  _createBasicClient() {
    return new GMOCoinSingleClient({ ...this.options, parent: this });
  }
}
class GMOCoinSingleClient extends BasicClient {
  constructor({ wssPath = "wss://api.coin.z.com/ws/public/v1", watcherMs, parent } = {}) {
    super(wssPath, "GMOCoin", undefined, watcherMs);

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.parent = parent;
  }

  _sendPong(id) {
    this._wss.send(JSON.stringify({ pong: id }));
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        command: "subscribe",
        channel: "ticker",
        symbol: remote_id,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        command: "unsubscribe",
        channel: "ticker",
        symbol: remote_id,
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        command: "subscribe",
        channel: "trades",
        symbol: remote_id,
        // option:'TAKER_ONLY'
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        command: "unsubscribe",
        channel: "trades",
        symbol: remote_id,
        // option:'TAKER_ONLY'
      })
    );
  }

  _sendSubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        command: "subscribe",
        channel: "orderbooks",
        symbol: remote_id,
      })
    );
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        command: "unsubscribe",
        channel: "orderbooks",
        symbol: remote_id,
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    if (msg.ping) {
      this._sendPong(msg.ping);
      return;
    }

    // tickers
    if (msg.channel === "ticker") {
      let market = this._tickerSubs.get(msg.symbol);
      if (!market) return;

      let ticker = this._constructTicker(msg, market);
      this.emit("ticker", ticker, market);
      return;
    }

    // trade
    if (msg.channel === "trades") {
      let market = this._tradeSubs.get(msg.symbol);
      if (!market) return;

      let trade = this._constructTrade(msg, market);
      this.emit("trade", trade, market);
      return;
    }

    // l2 snapshot
    if (msg.channel === "orderbooks") {
      let market = this._level2SnapshotSubs.get(msg.symbol);
      if (!market) return;

      let snapshot = this._constructLevel2Snapshot(msg, market);
      this.emit("l2snapshot", snapshot, market);
      return;
    }
  }

  _constructTicker(msg, market) {
    let { ask, bid, high, last, low, timestamp, volume } = msg;
    return new Ticker({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestamp: moment.utc(timestamp).valueOf(),
      last: last,
      high: high,
      low: low,
      volume: volume,
      bid,
      ask,
    });
  }

  _constructTrade(datum, market) {
    let { price, side, size, timestamp } = datum;
    let unix = moment(timestamp).valueOf();
    return new Trade({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      side: side.toLowerCase(),
      unix,
      price: price,
      amount: size,
    });
  }

  _constructLevel2Snapshot(msg, market) {
    let asks = msg.asks.map(p => new Level2Point(p.price, p.size));
    let bids = msg.bids.map(p => new Level2Point(p.price, p.size));
    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs: moment.utc(msg.timestamp).valueOf(),
      asks,
      bids,
    });
  }
}
module.exports = GMOCoinClient;
