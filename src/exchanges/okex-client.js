const semaphore = require("semaphore");
const BasicClient = require("../basic-client");
const Trade = require("../trade");

class OKExClient extends BasicClient {
  constructor() {
    super("wss://real.okex.com:10441/websocket", "OKEx");
    this._pingInterval = setInterval(this._sendPing.bind(this), 30000);
    this.on("connected", this._resetSemaphore.bind(this));

    this.hasTrades = true;
    this.hasLevel2Spotshots = true;
    this.hasLevel2Updates = true;
  }

  _resetSemaphore() {
    this._sem = semaphore(10);
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send(JSON.stringify({ event: "ping" }));
    }
  }

  _sendSubscribe(remote_id) {
    this._sem.take(() => {
      let [base, quote] = remote_id.split("_");
      this._wss.send(
        JSON.stringify({
          event: "addChannel",
          parameters: { base, binary: "0", product: "spot", quote, type: "deal" },
        })
      );
    });
  }

  _sendUnsubscribe(remote_id) {
    let [base, quote] = remote_id.split("_");
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        parameters: { base, binary: "0", product: "spot", quote, type: "deal" },
      })
    );
  }

  _sendSubLevel2Snapshots(remote_id, { depth = 20 } = {}) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          event: "addChannel",
          channel: `ok_sub_spot_${remote_id}_depth_${depth}`,
        })
      );
    });
  }

  _sendUnsubLevel2Snapshots(remote_id, { depth = 20 } = {}) {
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `ok_sub_spot_${remote_id}_depth_${depth}`,
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          event: "addChannel",
          channel: `ok_sub_spot_${remote_id}_depth`,
        })
      );
    });
  }

  _onMessage(raw) {
    let msgs = JSON.parse(raw);
    if (!Array.isArray(msgs)) return;

    for (let msg of msgs) {
      // clear semaphore
      if (msg.data.result) {
        this._sem.leave();
        continue;
      }

      // trades
      if (msg.product === "spot" && msg.type === "deal") {
        let { base, quote } = msg;
        let remote_id = `${base}_${quote}`;
        for (let datum of msg.data) {
          let trade = this._constructTradesFromMessage(remote_id, datum);
          this.emit("trade", trade);
        }
        return;
      }

      if (!msg.channel) return;

      // l2 snapshots
      if (
        msg.channel.endsWith("_5") ||
        msg.channel.endsWith("_10") ||
        msg.channel.endsWith("_20")
      ) {
        let snapshot = this._constructLevel2Snapshot(msg);
        this.emit("l2snapshot", snapshot);
        return;
      }

      // l2 updates
      if (msg.channel.endsWith("depth")) {
        let update = this._constructoL2Update(msg);
        this.emit("l2update", update);
        return;
      }
    }
  }

  _constructTradesFromMessage(remoteId, datum) {
    /*
    [{ base: '1st',
      binary: 0,
      channel: 'addChannel',
      data: { result: true },
      product: 'spot',
      quote: 'btc',
      type: 'deal' },
    { base: '1st',
      binary: 0,
      data:
      [ { amount: '818.619',
          side: 1,
          createdDate: 1527013680457,
          price: '0.00003803',
          id: 4979071 },
      ],
      product: 'spot',
      quote: 'btc',
      type: 'deal' }]
    */
    let { amount, side, createdDate, price, id } = datum;
    let market = this._tradeSubs.get(remoteId);

    amount = side === "2" ? -parseFloat(amount) : parseFloat(amount);
    let priceNum = parseFloat(price);
    let unix = Math.floor(createdDate / 1000);

    return new Trade({
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      unix,
      price: priceNum,
      amount,
    });
  }

  _constructLevel2Snapshot(msg) {
    /*
    [{
        "binary": 0,
        "channel": "ok_sub_spot_bch_btc_depth",
        "data": {
            "asks": [],
            "bids": [
                [
                    "115",
                    "1"
                ],
                [
                    "114",
                    "1"
                ],
                [
                    "1E-8",
                    "0.0008792"
                ]
            ],
            "timestamp": 1504529236946
        }
    }]
    */
    let remote_id = msg.channel.replace("ok_sub_spot_", "").replace(/_depth_\d+/, "");
    let market = this._level2SnapshotSubs.get(remote_id);
    let asks = msg.data.asks.map(p => ({ price: p[0], size: p[1] }));
    let bids = msg.data.bids.map(p => ({ price: p[0], size: p[1] }));
    return {
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      timestamp: msg.data.timestamp,
      asks,
      bids,
    };
  }

  _constructoL2Update(msg) {
    /*
    [{
        "binary": 0,
        "channel": "ok_sub_spot_bch_btc_depth",
        "data": {
            "asks": [],
            "bids": [
                [
                    "115",
                    "1"
                ],
                [
                    "114",
                    "1"
                ],
                [
                    "1E-8",
                    "0.0008792"
                ]
            ],
            "timestamp": 1504529236946
        }
    }]
    */
    let remote_id = msg.channel.replace("ok_sub_spot_", "").replace("_depth", "");
    let market = this._level2UpdateSubs.get(remote_id);
    let asks = msg.data.asks.map(p => ({ price: p[0], size: p[1] }));
    let bids = msg.data.bids.map(p => ({ price: p[0], size: p[1] }));
    return {
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      timestamp: msg.data.timestamp,
      asks,
      bids,
    };
  }
}

module.exports = OKExClient;
