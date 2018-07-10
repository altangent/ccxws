const BasicClient = require("../basic-client");
const Trade = require("../trade");
const zlib = require("zlib");
const winston = require("winston");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");

class HuobiClient extends BasicClient {
  constructor() {
    super("wss://api.huobi.pro/ws", "Huobi");
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
  }

  _sendPong(ts) {
    if (this._wss) {
      this._wss.send(JSON.stringify({ pong: ts }));
    }
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
        for (let datum of msgs.tick.data) {
          let trade = this._constructTradesFromMessage(remoteId, datum);
          this.emit("trade", trade);
        }
        return;
      }

      // level2updates
      if (msgs.ch.endsWith("depth.step0")) {
        let remoteId = msgs.ch.split(".")[1];
        let update = this._constructLevel2Snapshot(remoteId, msgs);
        this.emit("l2snapshot", update);
        return;
      }
    });
  }

  _constructTradesFromMessage(remoteId, datum) {
    let { amount, direction, ts, price, id } = datum;
    let market = this._tradeSubs.get(remoteId);
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

  _constructLevel2Snapshot(remoteId, msg) {
    let { ts, tick } = msg;
    let market = this._level2SnapshotSubs.get(remoteId);
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
