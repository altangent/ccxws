const zlib = require("zlib");
const semaphore = require("semaphore");
const moment = require("moment");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

const pongBuffer = Buffer.from("pong");

class OKExClient extends BasicClient {
  /**
   * Implements OKEx V3 WebSocket API as defined in
   * https://www.okex.com/docs/en/#spot_ws-general
   *
   * Limits:
   *    1 connection / second
   *    240 subscriptions / hour
   *
   * Connection will disconnect after 30 seconds of silence
   * it is recommended to send a ping message that contains the
   * message "ping".
   *
   * Order book depth includes maintenance of a checksum for the
   * first 25 values in the orderbook. Each update includes a crc32
   * checksum that can be run to validate that your order book
   * matches the server. If the order book does not match you should
   * issue a reconnect.
   *
   * Refer to: https://www.okex.com/docs/en/#spot_ws-checksum
   */
  constructor() {
    super("wss://real.okex.com:10442/ws/v3", "OKEx");
    this.on("connected", this._resetSemaphore.bind(this));
    this.on("connected", this._startPing.bind(this));
    this.on("disconnected", this._stopPing.bind(this));

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;
  }

  _resetSemaphore() {
    this._sem = semaphore(5);
    this._hasSnapshot = new Set();
  }

  _startPing() {
    this._pingInterval = setInterval(this._sendPing.bind(this), 15000);
  }

  _stopPing() {
    clearInterval(this._pingInterval);
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send("ping");
    }
  }

  _sendSubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          op: "subscribe",
          args: [`spot/ticker:${remote_id}`],
        })
      );
    });
  }

  _sendUnsubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          op: "unsubscribe",
          args: [`spot/ticker:${remote_id}`],
        })
      );
    });
  }

  _sendSubTrades(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          op: "subscribe",
          args: [`spot/trade:${remote_id}`],
        })
      );
    });
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`spot/trade:${remote_id}`],
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

  _onMessage(compressed) {
    zlib.inflateRaw(compressed, (err, raw) => {
      if (err) {
        console.error("failed to deflate", err);
        return;
      }

      // ignore pongs
      if (raw.equals(pongBuffer)) {
        return;
      }

      // process JSON message
      try {
        let msg = JSON.parse(raw);
        this._processsMessage(msg);
      } catch (ex) {
        console.error("JSON parsing failed", ex.message, raw.toString("utf8"));
      }
    });
  }

  _processsMessage(msg) {
    // clear semaphore on subscription event reply
    if (msg.event === "subscribe") {
      this._sem.leave();
      return;
    }

    // prevent failed messages from
    if (!msg.data) {
      console.warn("warn: failure response", JSON.stringify(msg));
      return;
    }

    // tickers
    if (msg.table === "spot/ticker") {
      for (let datum of msg.data) {
        // ensure market
        let remoteId = datum.instrument_id;
        let market = this._tickerSubs.get(remoteId);
        if (!market) continue;

        // construct and emit ticker
        let ticker = this._constructTicker(datum, market);
        this.emit("ticker", ticker, market);
      }
      return;
    }

    // trades
    if (msg.table === "spot/trade") {
      for (let datum of msg.data) {
        // ensure market
        let remoteId = datum.instrument_id;
        let market = this._tradeSubs.get(remoteId);
        if (!market) continue;

        // construct and emit trade
        let trade = this._constructTrade(datum, market);
        this.emit("trade", trade, market);
      }
      return;
    }

    // l2 snapshots
    if (msg.channel.endsWith("_5") || msg.channel.endsWith("_10") || msg.channel.endsWith("_20")) {
      let remote_id = msg.channel.replace("ok_sub_spot_", "").replace(/_depth_\d+/, "");
      let market = this._level2SnapshotSubs.get(remote_id) || this._level2UpdateSubs.get(remote_id);
      if (!market) return;

      let snapshot = this._constructLevel2Snapshot(msg, market);
      this.emit("l2snapshot", snapshot, market);
      return;
    }

    // l2 updates
    if (msg.channel.endsWith("depth")) {
      let remote_id = msg.channel.replace("ok_sub_spot_", "").replace("_depth", "");
      let market = this._level2UpdateSubs.get(remote_id);
      if (!market) return;

      if (!this._hasSnapshot.has(remote_id)) {
        let snapshot = this._constructLevel2Snapshot(msg, market);
        this.emit("l2snapshot", snapshot, market);
        this._hasSnapshot.add(remote_id);
      } else {
        let update = this._constructoL2Update(msg, market);
        this.emit("l2update", update, market);
      }
      return;
    }
  }

  _constructTicker(data, market) {
    /*
      { instrument_id: 'ETH-BTC',
        last: '0.02172',
        best_bid: '0.02172',
        best_ask: '0.02173',
        open_24h: '0.02254',
        high_24h: '0.02262',
        low_24h: '0.02051',
        base_volume_24h: '378400.064179',
        quote_volume_24h: '8226.4437921288',
        timestamp: '2019-07-15T16:10:40.193Z' }
     */
    let {
      last,
      best_bid,
      best_ask,
      open_24h,
      high_24h,
      low_24h,
      base_volume_24h,
      timestamp,
    } = data;

    let change = parseFloat(last) - parseFloat(open_24h);
    let changePercent = change / parseFloat(open_24h);
    let ts = moment.utc(timestamp).valueOf();
    return new Ticker({
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      timestamp: ts,
      last,
      open: open_24h,
      high: high_24h,
      low: low_24h,
      volume: base_volume_24h,
      change: change.toFixed(8),
      changePercent: changePercent.toFixed(2),
      bid: best_bid,
      ask: best_ask,
    });
  }

  _constructTrade(datum, market) {
    /**
      { instrument_id: 'ETH-BTC',
       price: '0.02182',
       side: 'sell',
       size: '0.94',
       timestamp: '2019-07-15T16:38:02.169Z',
       trade_id: '776370532' }
     */
    let { price, side, size, timestamp, trade_id } = datum;
    let ts = moment.utc(timestamp).valueOf();

    return new Trade({
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id,
      side,
      unix: ts,
      price,
      amount: size,
    });
  }

  _constructLevel2Snapshot(msg, market) {
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

  _constructoL2Update(msg, market) {
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
