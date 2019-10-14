const { EventEmitter } = require("events");
const zlib = require("zlib");
const Watcher = require("../watcher");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const { MarketObjectTypes } = require("../enums");
const semaphore = require("semaphore");
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
  constructor() {
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

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = false;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = false;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;
    this.subsPerClient = 20;
    this.throttleMs = 200;
    this.candleType = this._throttle = semaphore(1);
  }

  subscribeTicker(market) {
    this._throttleSubscribe(market, MarketObjectTypes.ticker);
  }

  unsubscribeTicker(market) {
    this._unsubscribe(market, MarketObjectTypes.ticker);
  }

  subscribeTrades(market) {
    this._throttleSubscribe(market, MarketObjectTypes.trade);
  }

  unsubscribeTrades(market) {
    this._unsubscribe(market, MarketObjectTypes.trade);
  }

  subscribeLevel2Snapshots(market) {
    this._throttleSubscribe(market, MarketObjectTypes.level2snapshot);
  }

  unsubscribeLevel2Snapshots(market) {
    this._unsubscribe(market, MarketObjectTypes.level2snapshot);
  }

  close() {
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

  /**
    This method wraps a call to subscribe with a semaphore that is realeased
    after a timeout period. This ensures that only so many subscribe methods
    are called with a certain time period.
    @param {*} market
    @param {*} marketObjectType
   */
  _throttleSubscribe(market, marketObjectType) {
    this._throttle.take(() => {
      // perform the subscribe method
      this._subscribe(market, marketObjectType);

      // release semaphore after throttle timeout
      setTimeout(() => this._throttle.leave(), this.throttleMs);
    });
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
      client = new BiboxBasicClient();

      // wire up the events to pass through
      client.on("connecting", () => this.emit("connecting", market, marketObjectType));
      client.on("connected", () => this.emit("connected", market, marketObjectType));
      client.on("disconnected", () => this.emit("disconnected", market, marketObjectType));
      client.on("reconnecting", () => this.emit("reconnecting", market, marketObjectType));
      client.on("closing", () => this.emit("closing", market, marketObjectType));
      client.on("closed", () => this.emit("closed", market, marketObjectType));
      client.on("ticker", (ticker, market) => this.emit("ticker", ticker, market));
      client.on("trade", (trade, market) => this.emit("trade", trade, market));
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
  constructor() {
    super("wss://push.bibox.com", "Bibox");
    this._watcher = new Watcher(this, 10 * 60 * 1000); // change to 10 minutes
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.subCount = 0;
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

module.exports = BiboxClient;
