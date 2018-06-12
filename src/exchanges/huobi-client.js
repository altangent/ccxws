const BasicClient = require("../basic-client");
const Trade = require("../trade");
const zlib = require("zlib");
const winston = require("winston");

class HuobiClient extends BasicClient {
  constructor() {
    super("wss://api.huobi.pro/ws", "Huobi");
    this.hasTrades = true;
    this.hasLevel2Spotshots = true;
  }

  _sendPong(ts) {
    if (this._wss) {
      this._wss.send(JSON.stringify({ pong: ts }));
    }
  }

  _sendSubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.trade.detail`,
        id: remote_id,
      })
    );
  }

  _sendUnsubscribe(remote_id) {
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
    let market = this._subscriptions.get(remoteId);

    amount = direction === "sell" ? -parseFloat(amount) : parseFloat(amount);
    let priceNum = parseFloat(price);
    let unix = Math.floor(ts / 1000);

    return new Trade({
      exchange: "Huobi",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      unix,
      price: priceNum,
      amount,
    });
  }

  _constructLevel2Snapshot(remoteId, msg) {
    let { ts, tick } = msg;
    let market = this._level2SnapshotSubs.get(remoteId);
    let bids = tick.bids.map(p => ({ price: p[0], size: p[1] }));
    let asks = tick.asks.map(p => ({ price: p[0], size: p[1] }));
    return {
      exchange: "Huobi",
      base: market.base,
      quote: market.quote,
      timestamp: ts,
      asks,
      bids,
    };
  }
}

module.exports = HuobiClient;
