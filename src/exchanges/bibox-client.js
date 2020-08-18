const { EventEmitter } = require("events");
const zlib = require("zlib");
const Watcher = require("../watcher");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Candle = require("../candle");
const { MarketObjectTypes, CandlePeriod } = require("../enums");
const { throttle } = require("../flowcontrol/throttle");
const { wait } = require("../util");

class BiboxClient extends EventEmitter {
  /**
    Bibox allows listening to multiple markets on the same
    socket. Unfortunately, they throw errors if you subscribe
    to too more than 20 markets at a time re:
    https://github.com/Biboxcom/API_Docs_en/wiki/WS_request#1-access-to-the-url
    This makes like hard and we need to batch connections, which
    is why we can't use the BasicMultiClient.
   */
  constructor(options) {
    super();

    /**
        Stores the client used for each subscription request with teh
        key: remoteId_subType
        The value is the underlying client that is used.
       */
    this._subClients = new Map();

    /**
        List of all active clients. Clients will be removed when all
        subscriptions have vanished.
       */
    this._clients = [];

    this.options = options;
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = false;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;
    this.subsPerClient = 20;
    this.throttleMs = 200;
    this._subscribe = throttle(this._subscribe.bind(this), this.throttleMs);
    this.candlePeriod = CandlePeriod._1m;
  }

  subscribeTicker(market) {
    this._subscribe(market, MarketObjectTypes.ticker);
  }

  unsubscribeTicker(market) {
    this._unsubscribe(market, MarketObjectTypes.ticker);
  }

  subscribeTrades(market) {
    this._subscribe(market, MarketObjectTypes.trade);
  }

  unsubscribeTrades(market) {
    this._unsubscribe(market, MarketObjectTypes.trade);
  }

  subscribeCandles(market) {
    this._subscribe(market, MarketObjectTypes.candle);
  }

  unsubscribeCandles(market) {
    this._unsubscribe(market, MarketObjectTypes.candle);
  }

  subscribeLevel2Snapshots(market) {
    this._subscribe(market, MarketObjectTypes.level2snapshot);
  }

  unsubscribeLevel2Snapshots(market) {
    this._unsubscribe(market, MarketObjectTypes.level2snapshot);
  }

  close() {
    this._subscribe.cancel();

    for (let client of this._clients) {
      client.close();
    }
  }

  async reconnect() {
    for (let client of this._clients) {
      client.reconnect();
      await wait(this.timeoutMs);
    }
  }

  _subscribe(market, marketObjectType) {
    // construct the subscription key from the remote_id and the type
    // of subscription being performed
    let subKey = market.id + "_" + marketObjectType;

    // try to find the subscription client from the existing lookup
    let client = this._subClients.get(subKey);

    // if we haven't seen this market sub before first try
    // to find an available existing client
    if (!client) {
      // first try to find a client that has less than 20 subscriptions...
      client = this._clients.find(p => p.subCount < this.subsPerClient);

      // make sure we set the value
      this._subClients.set(subKey, client);
    }

    // if we were unable to find any avaialble clients, we will need
    // to create a new client.
    if (!client) {
      // construct a new client
      client = new BiboxBasicClient(this.options);

      // set properties
      client.parent = this;

      // wire up the events to pass through
      client.on("connecting", () => this.emit("connecting", market, marketObjectType));
      client.on("connected", () => this.emit("connected", market, marketObjectType));
      client.on("disconnected", () => this.emit("disconnected", market, marketObjectType));
      client.on("reconnecting", () => this.emit("reconnecting", market, marketObjectType));
      client.on("closing", () => this.emit("closing", market, marketObjectType));
      client.on("closed", () => this.emit("closed", market, marketObjectType));
      client.on("ticker", (ticker, market) => this.emit("ticker", ticker, market));
      client.on("trade", (trade, market) => this.emit("trade", trade, market));
      client.on("candle", (candle, market) => this.emit("candle", candle, market));
      client.on("l2snapshot", (l2snapshot, market) => this.emit("l2snapshot", l2snapshot, market));
      client.on("error", err => this.emit("error", err));

      // push it into the list of clients
      this._clients.push(client);

      // make sure we set the value
      this._subClients.set(subKey, client);
    }

    // now that we have a client, call the sub method, which
    // should be an idempotent method, so no harm in calling it again
    switch (marketObjectType) {
      case MarketObjectTypes.ticker:
        client.subscribeTicker(market);
        break;
      case MarketObjectTypes.trade:
        client.subscribeTrades(market);
        break;
      case MarketObjectTypes.candle:
        client.subscribeCandles(market);
        break;
      case MarketObjectTypes.level2snapshot:
        client.subscribeLevel2Snapshots(market);
        break;
    }
  }

  _unsubscribe(market, marketObjectType) {
    // construct the subscription key from the remote_id and the type
    // of subscription being performed
    let subKey = market.id + "_" + marketObjectType;

    // find the client
    let client = this._subClients.get(subKey);

    // abort if nothign to do
    if (!client) return;

    // perform the unsubscribe operation
    switch (marketObjectType) {
      case MarketObjectTypes.ticker:
        client.unsubscribeTicker(market);
        break;
      case MarketObjectTypes.trade:
        client.unsubscribeTrades(market);
        break;
      case MarketObjectTypes.candle:
        client.unsubscribeCandles(market);
        break;
      case MarketObjectTypes.level2snapshot:
        client.unsubscribeLevel2Snapshots(market);
        break;
    }

    // remove the client if nothing left to do
    if (client.subCount === 0) {
      client.close();
      let idx = this._clients.indexOf(client);
      this._clients.splice(idx, 1);
    }
  }
}

class BiboxBasicClient extends BasicClient {
  /**
    Manages connections for a single market. A single
    socket is only allowed to work for 20 markets.
   */
  constructor({ wssPath = "wss://push.bibox.com", watcherMs = 600 * 1000 } = {}) {
    super(wssPath, "Bibox");
    this._watcher = new Watcher(this, watcherMs);
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = true;
    this.subCount = 0;
  }

  get candlePeriod() {
    return this.parent.candlePeriod;
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
    this.subCount++;
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `bibox_sub_spot_${remote_id}_ticker`,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this.subCount--;
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `bibox_sub_spot_${remote_id}_ticker`,
      })
    );
  }

  _sendSubTrades(remote_id) {
    this.subCount++;
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `bibox_sub_spot_${remote_id}_deals`,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this.subCount--;
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `bibox_sub_spot_${remote_id}_deals`,
      })
    );
  }

  _sendSubCandles(remote_id) {
    this.subCount++;
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `bibox_sub_spot_${remote_id}_kline_${candlePeriod(this.candlePeriod)}`,
      })
    );
  }

  _sendUnsubCandles(remote_id) {
    this.subCount--;
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        channel: `bibox_sub_spot_${remote_id}_kline_${candlePeriod(this.candlePeriod)}`,
      })
    );
  }

  _sendSubLevel2Snapshots(remote_id) {
    this.subCount++;
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        channel: `bibox_sub_spot_${remote_id}_depth`,
      })
    );
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    this.subCount--;
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
      let err = new Error(msg.error);
      err.message = msg;
      this.emit("error", err);
      return;
    }

    if (msg.channel.endsWith("_deals")) {
      // trades are send in descendinging order
      // out library standardize to asc order so perform a reverse
      let data = msg.data.slice().reverse();
      for (let datum of data) {
        let market = this._tradeSubs.get(datum.pair);
        if (!market) return;

        let trade = this._constructTradesFromMessage(datum, market);
        this.emit("trade", trade, market);
      }
      return;
    }

    // tickers
    if (msg.channel.endsWith("_ticker")) {
      let market = this._tickerSubs.get(msg.data.pair);
      if (!market) return;

      let ticker = this._constructTicker(msg, market);
      this.emit("ticker", ticker, market);
      return;
    }

    // l2 updates
    if (msg.channel.endsWith("depth")) {
      let remote_id = msg.data.pair;
      let market = this._level2SnapshotSubs.get(remote_id) || this._level2UpdateSubs.get(remote_id);
      if (!market) return;

      let snapshot = this._constructLevel2Snapshot(msg, market);
      this.emit("l2snapshot", snapshot, market);
      return;
    }

    // candle
    if (msg.channel.endsWith(`kline_${candlePeriod(this.candlePeriod)}`)) {
      // bibox_sub_spot_BTC_USDT_kline_1min
      let remote_id = msg.channel
        .replace("bibox_sub_spot_", "")
        .replace(`_kline_${candlePeriod(this.candlePeriod)}`, "");

      let market = this._candleSubs.get(remote_id);
      if (!market) return;

      for (let datum of msg.data) {
        let candle = this._constructCandle(datum, market);
        this.emit("candle", candle, market);
      }
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
  _constructTicker(msg, market) {
    let { last, buy, sell, vol, percent, low, high, timestamp } = msg.data;

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
  _constructTradesFromMessage(datum, market) {
    let { time, price, amount, side, id } = datum;

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

  /**
   {
      channel: 'bibox_sub_spot_BTC_USDT_kline_1min',
      binary: 1,
      data_type: 1,
      data: [
        {
          time: 1597259460000,
          open: '11521.38000000',
          high: '11540.58990000',
          low: '11521.28990000',
          close: '11540.56990000',
          vol: '11.24330000'
        },
        {
          time: 1597259520000,
          open: '11540.55990000',
          high: '11540.58990000',
          low: '11533.13000000',
          close: '11536.83990000',
          vol: '10.88200000'
        }
      ]
    }
   */
  _constructCandle(datum) {
    return new Candle(datum.time, datum.open, datum.high, datum.low, datum.close, datum.vol);
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
  _constructLevel2Snapshot(msg, market) {
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

function candlePeriod(period) {
  switch (period) {
    case CandlePeriod._1m:
      return "1min";
    case CandlePeriod._5m:
      return "5min";
    case CandlePeriod._15min:
      return "15min";
    case CandlePeriod._30min:
      return "30min";
    case CandlePeriod._1h:
      return "1hour";
    case CandlePeriod._2h:
      return "2hour";
    case CandlePeriod._4h:
      return "4hour";
    case CandlePeriod._6h:
      return "6hour";
    case CandlePeriod._12h:
      return "12hour";
    case CandlePeriod._1d:
      return "day";
    case CandlePeriod._1w:
      return "week";
  }
}

module.exports = BiboxClient;
