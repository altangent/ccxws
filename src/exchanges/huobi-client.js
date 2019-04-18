const BasicClient = require("../basic-client");
const zlib = require("zlib");
const winston = require("winston");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");

class HuobiClient extends BasicClient {
  constructor() {
    super("wss://api.huobi.pro/ws", "Huobi");
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
  }

  _sendPong(ts) {
    if (this._wss) {
      this._wss.send(JSON.stringify({ pong: ts }));
    }
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.detail`,
        id: remote_id,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        unsub: `market.${remote_id}.detail`,
        id: remote_id,
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.trade.detail`,
        id: remote_id,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        unsub: `market.${remote_id}.trade.detail`,
        id: remote_id,
      })
    );
  }

  _sendSubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.depth.step0`,
        id: "depth_" + remote_id,
      })
    );
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        unsub: `market.${remote_id}.depth.step0`,
      })
    );
  }

  _onMessage(raw) {
    zlib.unzip(raw, (err, resp) => {
      if (err) {
        winston.error(err);
        return;
      }

      let msgs = JSON.parse(resp);

      // handle pongs
      if (msgs.ping) {
        this._sendPong(msgs.ping);
        return;
      }

      if (!msgs.ch) return;

      // trades
      if (msgs.ch.endsWith("trade.detail")) {
        msgs = JSON.parse(resp.toString().replace(/:([0-9]{1,}\.{0,1}[0-9]{0,}),/g, ':"$1",'));

        let remoteId = msgs.ch.split(".")[1]; //market.ethbtc.trade.detail
        let market = this._tradeSubs.get(remoteId);
        if (!market) return;

        for (let datum of msgs.tick.data) {
          let trade = this._constructTradesFromMessage(datum, market);
          this.emit("trade", trade, market);
        }
        return;
      }

      // tickers
      if (msgs.ch.endsWith(".detail")) {
        let remoteId = msgs.ch.split(".")[1];
        let market = this._tickerSubs.get(remoteId);
        if (!market) return;

        let ticker = this._constructTicker(msgs.tick, market);
        this.emit("ticker", ticker, market);
        return;
      }

      // level2updates
      if (msgs.ch.endsWith("depth.step0")) {
        let remoteId = msgs.ch.split(".")[1];
        let market = this._level2SnapshotSubs.get(remoteId);
        if (!market) return;

        let update = this._constructLevel2Snapshot(msgs, market);
        this.emit("l2snapshot", update, market);
        return;
      }
    });
  }

  _constructTicker(data, market) {
    let { open, close, high, low, vol, amount } = data;
    let dayChange = close - open;
    let dayChangePercent = ((close - open) / open) * 100;
    return new Ticker({
      exchange: "Huobi",
      base: market.base,
      quote: market.quote,
      timestamp: Date.now(),
      last: close.toFixed(8),
      open: open.toFixed(8),
      high: high.toFixed(8),
      low: low.toFixed(8),
      volume: amount.toFixed(8),
      quoteVolume: vol.toFixed(8),
      change: dayChange.toFixed(8),
      changePercent: dayChangePercent.toFixed(8),
    });
  }

  _constructTradesFromMessage(datum, market) {
    let { amount, direction, ts, price, id } = datum;
    let unix = Math.trunc(parseInt(ts));

    return new Trade({
      exchange: "Huobi",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      side: direction,
      unix,
      price,
      amount,
    });
  }

  _constructLevel2Snapshot(msg, market) {
    let { ts, tick } = msg;
    let bids = tick.bids.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
    let asks = tick.asks.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
    return new Level2Snapshot({
      exchange: "Huobi",
      base: market.base,
      quote: market.quote,
      timestampMs: ts,
      asks,
      bids,
    });
  }
}

module.exports = HuobiClient;
