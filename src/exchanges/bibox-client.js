const semaphore = require("semaphore");
const pako = require("pako");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");

class BiboxClient extends BasicClient {
  constructor() {
    super("wss://push.bibox.com", "Bibox");
    this._pingInterval = setInterval(this._sendPing.bind(this), 30000);
    this.on("connected", this._resetSemaphore.bind(this));

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
  }

  _resetSemaphore() {
    this._sem = semaphore(5);
    this._hasSnapshot = new Set();
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
          channel: `bibox_sub_spot_${remote_id}_ticker`,
        })
      );
    });
  }

  _sendUnsubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          event: "removeChannel",
          channel: `bibox_sub_spot_${remote_id}_ticker`,
        })
      );
    });
  }

  _sendSubTrades(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          event: "addChannel",
          channel: "bibox_sub_spot_" + remote_id + "_deals",
        })
      );
    });
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: "bibox_sub_spot_" + remote_id + "_deals",
      })
    );
  }

  _sendSubLevel2Snapshots(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          event: "addChannel",
          channel: `bibox_sub_spot_${remote_id}_depth`,
        })
      );
    });
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `bibox_sub_spot_${remote_id}_depth`,
      })
    );
  }

  _onMessage(raw) {
    try {
      let msgs = typeof raw == "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(msgs)) {
        for (let msg of msgs) {
          this._processsMessage(msg);
        }
      } else {
        this._processsMessage(msgs);
      }
    } catch (ex) {
      //console.log(raw);
      //console.warn(`failed to parse json ${ex.message}`);
    }
  }

  _processsMessage(msg) {
    if (typeof msg.data == "string") {
      let text = pako.inflate(Buffer.from(msg.data, "base64"), {
        to: "string",
      });
      msg.data = JSON.parse(text);
    }

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
    if (msg.channel.endsWith("_deals")) {
      for (let datum of msg.data) {
        let trade = this._constructTradesFromMessage(datum);
        this.emit("trade", trade);
      }
      return;
    }

    if (!msg.channel) {
      if (msg.event !== "pong") console.log(msg);
      return;
    }

    // tickers
    if (msg.channel.endsWith("_ticker")) {
      let ticker = this._constructTicker(msg);
      this.emit("ticker", ticker);
      return;
    }

    // l2 updates
    if (msg.channel.endsWith("depth")) {
      let snapshot = this._constructLevel2Snapshot(msg);
      this.emit("l2snapshot", snapshot);
      return;
    }
  }

  _constructTicker(msg) {
    /*
    { channel: 'bibox_sub_spot_BIX_BTC_ticker',
      binary: 1,
      data_type: 1,
      data:
      { last: '0.00003573',
        buy: '0.00003554',
        sell: '0.00003589',
        base_last_cny: '0.86774973',
        last_cny: '0.86',
        buy_amount: '6.1867',
        percent: '-1.68%',
        pair: 'BIX_BTC',
        high: '0.00003700',
        vol: '737995',
        last_usd: '0.12',
        low: '0.00003535',
        sell_amount: '880.0475',
        timestamp: 1547546988399 } }
     */

    let { last, buy, sell, pair, vol, percent, low, high, timestamp } = msg.data;
    percent = percent.replace("%", "");
    let market = this._tickerSubs.get(pair);
    return new Ticker({
      exchange: "Bibox",
      base: market.base,
      quote: market.quote,
      timestamp,
      last,
      open: undefined,
      high: high,
      low: low,
      volume: vol,
      change: undefined,
      changePercent: percent,
      bid: buy,
      ask: sell,
    });
  }

  _constructTradesFromMessage(datum) {
    /*
    { channel: 'bibox_sub_spot_BIX_BTC_deals',
      binary: '1',
      data_type: 1,
      data:
      [ { pair: 'BIX_BTC',
          time: 1547544945204,
          price: 0.0000359,
          amount: 6.1281,
          side: 2,
          id: 189765713 } ] }
    */
    let { pair, time, price, amount, side, id } = datum;
    let market = this._tradeSubs.get(pair);
    side = side === 1 ? "buy" : "sell";

    return new Trade({
      exchange: "Bibox",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      side,
      unix: time,
      price,
      amount,
    });
  }

  _constructLevel2Snapshot(msg) {
    /*
    [{
        "binary": 0,
        "channel": "ok_sub_spot_bch_btc_depth",
        "data": { update_time: 1547549824601,
            asks:
            [ { volume: '433.588', price: '0.00003575' },
              { volume: '1265.6753', price: '0.00003576' },
                 ..
              { volume: '69.5745', price: '0.000041' },
              { volume: '5.277', price: '0.00004169' },
              ... 100 more items ],
            bids:
            [ { volume: '6.1607', price: '0.00003571' },
              { volume: '704.8954', price: '0.00003538' },
                 ..
              { volume: '155000', price: '2e-8' },
              { volume: '8010000', price: '1e-8' } ],
            pair: 'BIX_BTC' }
    }]
    */

    let remote_id = msg.data.pair;
    let market = this._level2SnapshotSubs.get(remote_id) || this._level2UpdateSubs.get(remote_id);
    let asks = msg.data.asks.map(p => new Level2Point(p.price, p.volume));
    let bids = msg.data.bids.map(p => new Level2Point(p.price, p.volume));
    return new Level2Snapshot({
      exchange: "Bibox",
      base: market.base,
      quote: market.quote,
      timestampMs: msg.data.update_time,
      asks,
      bids,
    });
  }
}

module.exports = BiboxClient;
