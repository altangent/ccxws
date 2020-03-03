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
    super("wss://real.okex.com:8443/ws/v3", "OKEx");
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;
  }

  _beforeConnect() {
    this._wss.prependListener("connected", this._resetSemaphore.bind(this));
    this._wss.on("connected", this._startPing.bind(this));
    this._wss.on("disconnected", this._stopPing.bind(this));
    this._wss.on("closed", this._stopPing.bind(this));
  }

  _resetSemaphore() {
    this._sem = semaphore(5);
    this._hasSnapshot = new Set();
  }

  _startPing() {
    clearInterval(this._pingInterval);
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

  _sendSubLevel2Snapshots(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          op: "subscribe",
          args: [`spot/depth5:${remote_id}`],
        })
      );
    });
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`spot/depth5:${remote_id}`],
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          op: "subscribe",
          args: [`spot/depth:${remote_id}`],
        })
      );
    });
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`spot/depth:${remote_id}`],
      })
    );
  }

  _onMessage(compressed) {
    zlib.inflateRaw(compressed, (err, raw) => {
      if (err) {
        this.emit("error", err);
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
        this.emit("error", ex);
      }
    });
  }

  _processsMessage(msg) {
    // clear semaphore on subscription event reply
    if (msg.event === "subscribe") {
      this._sem.leave();
      return;
    }

    // ignore unsubscribe
    if (msg.event === "unsubscribe") {
      return;
    }

    // prevent failed messages from
    if (!msg.data) {
      console.warn("warn: failure response", JSON.stringify(msg));
      return;
    }

    // tickers
    if (msg.table === "spot/ticker") {
      this._processTicker(msg);
      return;
    }

    // trades
    if (msg.table === "spot/trade") {
      this._processTrades(msg);
      return;
    }

    // l2 snapshots
    if (msg.table === "spot/depth5") {
      this._processLevel2Snapshot(msg);
      return;
    }

    // l2 updates
    if (msg.table === "spot/depth") {
      this._processLevel2Update(msg);
      return;
    }
  }

  /**
   * Process ticker messages in the format
    { table: 'spot/ticker',
      data:
      [ { instrument_id: 'ETH-BTC',
          last: '0.02181',
          best_bid: '0.0218',
          best_ask: '0.02181',
          open_24h: '0.02247',
          high_24h: '0.02262',
          low_24h: '0.02051',
          base_volume_24h: '379522.2418555',
          quote_volume_24h: '8243.729793336415',
          timestamp: '2019-07-15T17:10:55.671Z' } ] }
   */
  _processTicker(msg) {
    for (let datum of msg.data) {
      // ensure market
      let remoteId = datum.instrument_id;
      let market = this._tickerSubs.get(remoteId);
      if (!market) continue;

      // construct and emit ticker
      let ticker = this._constructTicker(datum, market);
      this.emit("ticker", ticker, market);
    }
  }

  /**
   * Processes trade messages in the format
    { table: 'spot/trade',
      data:
      [ { instrument_id: 'ETH-BTC',
          price: '0.0218',
          side: 'sell',
          size: '1.1',
          timestamp: '2019-07-15T17:10:56.047Z',
          trade_id: '776432498' } ] }
   */
  _processTrades(msg) {
    for (let datum of msg.data) {
      // ensure market
      let remoteId = datum.instrument_id;
      let market = this._tradeSubs.get(remoteId);
      if (!market) continue;

      // construct and emit trade
      let trade = this._constructTrade(datum, market);
      this.emit("trade", trade, market);
    }
  }

  /**
   * Processes a level 2 snapshot message in the format:
      { table: 'spot/depth5',
        data: [{
            asks: [ ['0.02192', '1.204054', '3' ] ],
            bids: [ ['0.02191', '15.117671', '3' ] ],
            instrument_id: 'ETH-BTC',
            timestamp: '2019-07-15T16:54:42.301Z' } ] }
   */
  _processLevel2Snapshot(msg) {
    for (let datum of msg.data) {
      // ensure market
      let remote_id = datum.instrument_id;
      let market = this._level2SnapshotSubs.get(remote_id);
      if (!market) return;

      // construct snapshot
      let snapshot = this._constructLevel2Snapshot(datum, market);
      this.emit("l2snapshot", snapshot, market);
    }
  }

  /**
   * Processes a level 2 update message in one of two formats.
   * The first message received is the "partial" orderbook and contains
   * 200 records in it.
   *
    { table: 'spot/depth',
          action: 'partial',
          data:
            [ { instrument_id: 'ETH-BTC',
                asks: [Array],
                bids: [Array],
                timestamp: '2019-07-15T17:18:31.737Z',
                checksum: 723501244 } ] }
   *
   * Subsequent calls will include the updates stream for changes to
   * the order book:
   *
      { table: 'spot/depth',
      action: 'update',
      data:
        [ { instrument_id: 'ETH-BTC',
            asks: [Array],
            bids: [Array],
            timestamp: '2019-07-15T17:18:32.289Z',
            checksum: 680530848 } ] }
   */
  _processLevel2Update(msg) {
    let action = msg.action;
    for (let datum of msg.data) {
      // ensure market
      let remote_id = datum.instrument_id;
      let market = this._level2UpdateSubs.get(remote_id);
      if (!market) continue;

      // handle updates
      if (action === "partial") {
        let snapshot = this._constructLevel2Snapshot(datum, market);
        this.emit("l2snapshot", snapshot, market);
      } else if (action === "update") {
        let update = this._constructLevel2Update(datum, market);
        this.emit("l2update", update, market);
      } else {
        console.error("Unknown action type", msg);
      }
    }
  }

  /**
   * Constructs a ticker from the datum in the format:
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
  _constructTicker(data, market) {
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

  /**
   * Constructs a trade from the message datum in format:
    { instrument_id: 'ETH-BTC',
      price: '0.02182',
      side: 'sell',
      size: '0.94',
      timestamp: '2019-07-15T16:38:02.169Z',
      trade_id: '776370532' }
    */
  _constructTrade(datum, market) {
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

  /**
   * Constructs a snapshot message from the datum in a
   * snapshot message data property. Datum in the format:
   *
      { instrument_id: 'ETH-BTC',
        asks: [ ['0.02192', '1.204054', '3' ] ],
        bids: [ ['0.02191', '15.117671', '3' ] ],
        timestamp: '2019-07-15T16:54:42.301Z' }
   *
   * The snapshot may also come from an update, in which case we need
   * to include the checksum
   *
      { instrument_id: 'ETH-BTC',
        asks: [ ['0.02192', '1.204054', '3' ] ],
        bids: [ ['0.02191', '15.117671', '3' ] ],
        timestamp: '2019-07-15T17:18:31.737Z',
        checksum: 723501244 }

   */
  _constructLevel2Snapshot(datum, market) {
    let asks = datum.asks.map(p => new Level2Point(p[0], p[1], p[2]));
    let bids = datum.bids.map(p => new Level2Point(p[0], p[1], p[2]));
    let ts = moment.utc(datum.timestamp).valueOf();
    let checksum = datum.checksum;
    return new Level2Snapshot({
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      timestampMs: ts,
      asks,
      bids,
      checksum,
    });
  }

  /**
   * Constructs an update message from the datum in the update
   * stream. Datum is in the format:
    { instrument_id: 'ETH-BTC',
      asks: [ ['0.02192', '1.204054', '3' ] ],
      bids: [ ['0.02191', '15.117671', '3' ] ],
      timestamp: '2019-07-15T17:18:32.289Z',
      checksum: 680530848 }
   */
  _constructLevel2Update(datum, market) {
    let asks = datum.asks.map(p => new Level2Point(p[0], p[1], p[2]));
    let bids = datum.bids.map(p => new Level2Point(p[0], p[1], p[2]));
    let ts = moment.utc(datum.timestamp).valueOf();
    let checksum = datum.checksum;
    return new Level2Update({
      exchange: "OKEx",
      base: market.base,
      quote: market.quote,
      timestampMs: ts,
      asks,
      bids,
      checksum,
    });
  }
}

module.exports = OKExClient;
