const semaphore = require("semaphore");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class OKExClient extends BasicClient {
  constructor() {
    super("wss://real.okex.com:10441/websocket", "OKEx");
    this._pingInterval = setInterval(this._sendPing.bind(this), 30000);
    this.on("connected", this._resetSemaphore.bind(this));

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
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

  _sendSubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          event: "addChannel",
          channel: `ok_sub_spot_${remote_id}_ticker`,
        })
      );
    });
  }

  _sendUnsubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          event: "removeChannel",
          channel: `ok_sub_spot_${remote_id}_ticker`,
        })
      );
    });
  }

  _sendSubTrades(remote_id) {
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

  _sendUnsubTrades(remote_id) {
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

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `ok_sub_spot_${remote_id}_depth`,
      })
    );
  }

  _onMessage(raw) {
    let msgs = JSON.parse(raw);

    if (Array.isArray(msgs)) {
      for (let msg of msgs) {
        this._processsMessage(msg);
      }
    } else {
      this._processsMessage(msgs);
    }
  }

  _processsMessage(msg) {
    // clear semaphore
    if (msg.data && msg.data.result) {
      this._sem.leave();
      return;
    }

    // prevent failed messages from
    if (msg.data && msg.data.result === false) {
      console.log("warn: failure response", JSON.stringify(msg));
      return;
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

    // tickers
    if (msg.channel.endsWith("_ticker")) {
      let ticker = this._constructTicker(msg);
      this.emit("ticker", ticker);
      return;
    }

    // l2 snapshots
    if (msg.channel.endsWith("_5") || msg.channel.endsWith("_10") || msg.channel.endsWith("_20")) {
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

  _constructTicker(msg) {
    /*
    { binary: 0,
    channel: 'ok_sub_spot_eth_btc_ticker',
    data:
    { high: '0.07121405',
      vol: '53824.717918',
      last: '0.07071044',
      low: '0.06909468',
      buy: '0.07065946',
      change: '0.00141498',
      sell: '0.07071625',
      dayLow: '0.06909468',
      close: '0.07071044',
      dayHigh: '0.07121405',
      open: '0.06929546',
      timestamp: 1531692991115 } }
     */
    let remoteId = msg.channel.substr("ok_sub_spot_".length).replace("_ticker", "");
    let market = this._tickerSubs.get(remoteId);
    let { open, vol, last, buy, change, sell, dayLow, dayHigh, timestamp } = msg.data;
    let dayChangePercent = (parseFloat(change) / parseFloat(open)) * 100;
    return new Ticker({
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      timestamp,
      last,
      open,
      high: dayHigh,
      low: dayLow,
      volume: vol,
      change: change,
      changePercent: dayChangePercent.toFixed(2),
      bid: buy,
      ask: sell,
    });
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
    side = side === 1 ? "buy" : "sell";

    return new Trade({
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      side,
      unix: createdDate,
      price,
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
    let asks = msg.data.asks.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.data.bids.map(p => new Level2Point(p[0], p[1]));
    return new Level2Snapshot({
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      timestampMs: msg.data.timestamp,
      asks,
      bids,
    });
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
    let asks = msg.data.asks.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.data.bids.map(p => new Level2Point(p[0], p[1]));
    return new Level2Update({
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      timestampMs: msg.data.timestamp,
      asks,
      bids,
    });
  }
}

module.exports = OKExClient;
