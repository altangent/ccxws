const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");

class HuobiClient extends BasicClient {
  constructor() {
    super("wss://api.zb.cn/websocket ", "ZB");
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.remoteIdMap = new Map();
  }

  _sendSubTicker(remote_id) {
    let wss_remote_id = remote_id.replace(/_/, "");
    this.remoteIdMap.set(wss_remote_id, remote_id);
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `${wss_remote_id}_ticker`,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    let wss_remote_id = remote_id.replace(/_/, "");
    this.remoteIdMap.set(wss_remote_id, remote_id);
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `${wss_remote_id}_ticker`,
      })
    );
  }

  _sendSubTrades(remote_id) {
    let wss_remote_id = remote_id.replace(/_/, "");
    this.remoteIdMap.set(wss_remote_id, remote_id);
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `${wss_remote_id}_trades`,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    let wss_remote_id = remote_id.replace(/_/, "");
    this.remoteIdMap.set(wss_remote_id, remote_id);
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `${wss_remote_id}_trades`,
      })
    );
  }

  _sendSubLevel2Snapshots(remote_id) {
    let wss_remote_id = remote_id.replace(/_/, "");
    this.remoteIdMap.set(wss_remote_id, remote_id);
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `${wss_remote_id}_depth`,
      })
    );
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    let wss_remote_id = remote_id.replace(/_/, "");
    this.remoteIdMap.set(wss_remote_id, remote_id);
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `${wss_remote_id}_depth`,
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);
    let [wssRemoteId, type] = msg.channel.split("_");
    let remoteId = this.remoteIdMap.get(wssRemoteId);

    // prevent errors from crashing the party
    if (msg.success === false) {
      return;
    }

    // tickers
    if (type === "ticker") {
      let market = this._tickerSubs.get(remoteId);
      let ticker = this._constructTicker(msg, market);
      this.emit("ticker", ticker, market);
      return;
    }

    // trades
    if (type === "trades") {
      for (let datum of msg.data) {
        let market = this._tradeSubs.get(remoteId);
        let trade = this._constructTradesFromMessage(datum, market);
        this.emit("trade", trade, market);
      }
      return;
    }

    // level2snapshots
    if (type === "depth") {
      let market = this._level2SnapshotSubs.get(remoteId);
      let snapshot = this._constructLevel2Snapshot(msg, market);
      this.emit("l2snapshot", snapshot, market);
      return;
    }
  }

  _constructTicker(data, market) {
    let timestamp = parseInt(data.date);
    let ticker = data.ticker;
    return new Ticker({
      exchange: "ZB",
      base: market.base,
      quote: market.quote,
      timestamp,
      last: ticker.last,
      open: undefined,
      high: ticker.high,
      low: ticker.low,
      volume: ticker.vol,
      quoteVolume: undefined,
      change: undefined,
      changePercent: undefined,
      bid: ticker.buy,
      ask: ticker.sell,
    });
  }

  _constructTradesFromMessage(datum, market) {
    let { date, price, amount, tid, type } = datum;
    return new Trade({
      exchange: "ZB",
      base: market.base,
      quote: market.quote,
      tradeId: tid.toString(),
      side: type,
      unix: parseInt(date) * 1000,
      price,
      amount,
    });
  }

  _constructLevel2Snapshot(msg, market) {
    let { timestamp, asks, bids } = msg;
    asks = asks.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8))).reverse();
    bids = bids.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
    return new Level2Snapshot({
      exchange: "ZB",
      base: market.base,
      quote: market.quote,
      timestampMs: timestamp * 1000,
      asks,
      bids,
    });
  }
}

module.exports = HuobiClient;
