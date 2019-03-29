const winston = require("winston");
const zlib = require("zlib");
const Watcher = require("../watcher");
const BasicClient = require("../basic-client");
const BasicMultiClient = require("../basic-multiclient");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");

class BiboxClient extends BasicMultiClient {
  /**
    Bibox allows listening to multiple markets on the same
    socket. Unfortunately, they throw errors if you subscribe
    to too more than 20 markets at a time. As a result, we
    will need to use the basic multiclient.
   */
  constructor() {
    super();
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
  }

  _createBasicClient() {
    return new BiboxSingleClient();
  }
}

class BiboxSingleClient extends BasicClient {
  /**
    Manages connections for a single market. A single
    socket is only allowed to work for 20 markets.
   */
  constructor() {
    super("wss://push.bibox.com", "Bibox");
    this._watcher = new Watcher(this, 15 * 60 * 1000); // change to 15 minutes
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
  }

  /**
    Server will occassionally send ping messages. Client is expected
    to respond with a pong message that matches the identifier.
    If client fails to do this, server will abort connection after
    second attempt.
   */
  _sendPong(id) {
    this._wss.send(JSON.stringify({ pong: id }));
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `bibox_sub_spot_${remote_id}_ticker`,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `bibox_sub_spot_${remote_id}_ticker`,
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `bibox_sub_spot_${remote_id}_deals`,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `bibox_sub_spot_${remote_id}_deals`,
      })
    );
  }

  _sendSubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `bibox_sub_spot_${remote_id}_depth`,
      })
    );
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `bibox_sub_spot_${remote_id}_depth`,
      })
    );
  }

  /**
    Message usually arives as a string, that must first be converted
    to JSON. Then we can process each message in the payload and
    perform gunzip on the data.
   */
  _onMessage(raw) {
    let msgs = typeof raw == "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(msgs)) {
      for (let msg of msgs) {
        this._processsMessage(msg);
      }
    } else {
      this._processsMessage(msgs);
    }
  }

  /**
    Process the individaul message that was sent from the server.
    Message will be informat:

    {
      channel: 'bibox_sub_spot_BTC_USDT_deals',
      binary: '1',
      data_type: 1,
      data:
        'H4sIAAAAAAAA/xTLMQ6CUAyA4bv8c0Ne4RWeHdUbiJMxhghDB5QgTsa7Gw/wXT4sQ6w4+/5wO5+OPcIW84SrWdPtsllbrAjLGvcJJ6cmVZoNYZif78eGo1UqjSK8YvxLIUa8bjWnrtbyvf4CAAD//1PFt6BnAAAA'
    }
   */
  _processsMessage(msg) {
    // if we detect gzip data, we need to process it
    if (msg.binary == 1) {
      let buffer = zlib.gunzipSync(Buffer.from(msg.data, "base64"));
      msg.data = JSON.parse(buffer);
    }

    // server will occassionally send a ping message and client
    // must respon with appropriate identifier
    if (msg.ping) {
      this._sendPong(msg.ping);
      return;
    }

    // watch for error messages
    if (msg.error) {
      winston.error(msg);
      return;
    }

    if (msg.channel.endsWith("_deals")) {
      // trades are send in descendinging order
      // out library standardize to asc order so perform a reverse
      let data = msg.data.slice().reverse();
      for (let datum of data) {
        let trade = this._constructTradesFromMessage(datum);
        if (trade) this.emit("trade", trade);
      }
      return;
    }

    // tickers
    if (msg.channel.endsWith("_ticker")) {
      let ticker = this._constructTicker(msg);
      if (ticker) this.emit("ticker", ticker);
      return;
    }

    // l2 updates
    if (msg.channel.endsWith("depth")) {
      let snapshot = this._constructLevel2Snapshot(msg);
      if (snapshot) this.emit("l2snapshot", snapshot);
      return;
    }
  }

  /*
    Constructs a ticker from the source
    {
      channel: 'bibox_sub_spot_BIX_BTC_ticker',
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
        timestamp: 1547546988399 }
      }
  */
  _constructTicker(msg) {
    let { last, buy, sell, pair, vol, percent, low, high, timestamp } = msg.data;
    let market = this._tickerSubs.get(pair);
    if (!market) return;

    percent = percent.replace(/%|\+/g, "");
    let change = (parseFloat(last) * parseFloat(percent)) / 100;
    let open = parseFloat(last) - change;

    return new Ticker({
      exchange: "Bibox",
      base: market.base,
      quote: market.quote,
      timestamp,
      last,
      open: open.toFixed(8),
      high: high,
      low: low,
      volume: vol,
      change: change.toFixed(8),
      changePercent: percent,
      bid: buy,
      ask: sell,
    });
  }

  /*
    Construct a trade
    {
      channel: 'bibox_sub_spot_BIX_BTC_deals',
      binary: '1',
      data_type: 1,
      data:
      [ { pair: 'BIX_BTC',
          time: 1547544945204,
          price: 0.0000359,
          amount: 6.1281,
          side: 2,
          id: 189765713 } ]
    }
  */
  _constructTradesFromMessage(datum) {
    let { pair, time, price, amount, side, id } = datum;

    let market = this._tradeSubs.get(pair);
    if (!market) return;

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

  /* Converts from a raw message
    {
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
    }
  */
  _constructLevel2Snapshot(msg) {
    let remote_id = msg.data.pair;
    let market = this._level2SnapshotSubs.get(remote_id) || this._level2UpdateSubs.get(remote_id);
    if (!market) return;

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
