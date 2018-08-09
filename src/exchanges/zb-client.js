const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");

class HuobiClient extends BasicClient {
  constructor() {
    super("wss://api.zb.cn:9999/websocket ", "ZB");
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
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

  _sendSubLevel2Updates(remote_id) {
    let wss_remote_id = remote_id.replace(/_/, "");
    this.remoteIdMap.set(wss_remote_id, remote_id);
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `${wss_remote_id}_depth`,
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
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
      let ticker = this._constructTicker(remoteId, msg);
      this.emit("ticker", ticker);
      return;
    }

    // trades
    if (type === "trades") {
      for (let datum of msg.data) {
        let trade = this._constructTradesFromMessage(remoteId, datum);
        this.emit("trade", trade);
      }
      return;
    }

    // level2updates
    if (type === "depth") {
      let snapshot = this._constructLevel2Update(remoteId, msg);
      this.emit("l2update", snapshot);
      return;
    }
  }

  _constructTicker(remoteId, data) {
    let market = this._tickerSubs.get(remoteId);
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

  _constructTradesFromMessage(remoteId, datum) {
    let market = this._tradeSubs.get(remoteId);
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

  _constructLevel2Update(remoteId, msg) {
    let market = this._level2UpdateSubs.get(remoteId);
    let { timestamp, asks, bids } = msg;
    asks = asks.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
    bids = bids.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
    return new Level2Update({
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
