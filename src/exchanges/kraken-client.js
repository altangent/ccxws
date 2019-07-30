const winston = require("winston");
const Decimal = require("decimal.js");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const https = require("../https");

class KrakenClient extends BasicClient {
  /**
    Kraken's API documentation is availble at:
    https://www.kraken.com/features/websocket-api

    Once the socket is open you can subscribe to a channel by sending
    a subscribe request message.

    Ping is initiated by the client, not the server. This means
    we do not need to listen for pings events or respond appropriately.

    Requests take an array of pairs to subscribe to an event. This means
    when we subscribe or unsubscribe we need to send the COMPLETE list
    of active markets. BasicClient maintains the list of active markets
    in the various maps: _tickerSubs, _tradeSubs, _level2UpdateSubs.

    This client will retrieve the market keys from those maps to
    determine the remoteIds to send to the server on all sub/unsub requests.
  */
  constructor({ autoloadSymbolMaps = true } = {}) {
    super("wss://ws.kraken.com", "Kraken");

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
    this.hasLevel2Snapshots = false;

    this.subscriptionLog = new Map();
    this.debouceTimeoutHandles = new Map();
    this.debounceWait = 200;

    this.fromRestMap = new Map();
    this.fromWsMap = new Map();

    if (autoloadSymbolMaps) {
      this.loadSymbolMaps().catch(winston.error);
    }
  }

  /**
    Kraken made the websocket symbols different
    than the REST symbols. Because CCXT uses the REST symbols,
    we're going to default to receiving REST symbols and mapping them
    to the corresponding WS symbol.

    In order to do this, we'll need to retrieve the list of symbols from
    the REST API. The constructor executes this.
   */
  async loadSymbolMaps() {
    let uri = "https://api.kraken.com/0/public/AssetPairs";
    let { result } = await https.get(uri);
    for (let symbol in result) {
      let restName = symbol;
      let wsName = result[symbol].wsname;
      if (wsName) {
        this.fromRestMap.set(restName, wsName);
        this.fromWsMap.set(wsName, restName);
      }
    }
    winston.info(`symbol maps loaded for ${this.fromRestMap.size} markets`);
  }

  /**
    Helper that retrieves the list of ws symbols from the supplied
    subscription map. The BasicClient manages the subscription maps
    when subscribe<Trade|Ticker|etc> is called and adds the records.
    This helper will take the values in a subscription map and
    convert them into the websocket symbols, ensuring that markets
    that are not mapped do not get included in the list.

    @param {Map} map subscription map such as _tickerSubs or _tradeSubs
   */
  _wsSymbolsFromSubMap(map) {
    let restSymbols = Array.from(map.keys());
    return restSymbols.map(p => this.fromRestMap.get(p)).filter(p => p);
  }

  /**
    Debounce is used to throttle a function that is repeatedly called. This
    is applicable when many calls to subscribe or unsubscribe are executed
    in quick succession by the calling application.
   */
  _debounce(type, fn) {
    clearTimeout(this.debouceTimeoutHandles.get(type));
    this.debouceTimeoutHandles.set(type, setTimeout(fn, this.debounceWait));
  }

  /**
    This method is called by each of the _send* methods.  It uses
    a debounce function on a given key so we can batch send the request
    with the active symbols. We also need to convert the rest symbols
    provided by the caller into websocket symbols used by the Kraken
    ws server.

    @param {string} debounceKey unique key for the caller so each call
    is debounced with related calls
    @param {Map} subMap subscription map storing the current subs
    for the type, such as _tickerSubs, _tradeSubs, etc.
    @param {boolean} subscribe true for subscribe, false for unsubscribe
    @param {string} subName the subscription name passed to the
    JSON-RPC call
   */
  _debounceSend(debounceKey, subMap, subscribe, subscription) {
    this._debounce(debounceKey, () => {
      let wsSymbols = this._wsSymbolsFromSubMap(subMap);
      if (!this._wss) return;
      this._wss.send(
        JSON.stringify({
          event: subscribe ? "subscribe" : "unsubscribe",
          pair: wsSymbols,
          subscription,
        })
      );
    });
  }

  /**
    Constructs a request that looks like:
    {
      "event": "subscribe",
      "pair": ["XBT/USD","BCH/USD"]
      "subscription": {
        "name": "ticker"
      }
    }
   */
  _sendSubTicker() {
    this._debounceSend("sub-ticker", this._tickerSubs, true, { name: "ticker" });
  }

  /**
    Constructs a request that looks like:
    {
      "event": "unsubscribe",
      "pair": ["XBT/USD","BCH/USD"]
      "subscription": {
        "name": "ticker"
      }
    }
   */
  _sendUnsubTicker() {
    this._debounceSend("unsub-ticker", this._tickerSubs, false, { name: "ticker" });
  }

  /**
    Constructs a request that looks like:
    {
      "event": "subscribe",
      "pair": ["XBT/USD","BCH/USD"]
      "subscription": {
        "name": "trade"
      }
    }
   */
  _sendSubTrades() {
    this._debounceSend("sub-trades", this._tradeSubs, true, { name: "trade" });
  }

  /**
    Constructs a request that looks like:
    {
      "event": "unsubscribe",
      "pair": ["XBT/USD","BCH/USD"]
      "subscription": {
        "name": "trade"
      }
    }
   */
  _sendUnsubTrades() {
    this._debounceSend("unsub-trades", this._tradeSubs, false, { name: "trade" });
  }

  /**
    Constructs a request that looks like:
    {
      "event": "subscribe",
      "pair": ["XBT/USD","BCH/USD"]
      "subscription": {
        "name": "book"
      }
    }
   */
  _sendSubLevel2Updates() {
    this._debounceSend("sub-l2updates", this._level2UpdateSubs, true, {
      name: "book",
      depth: 1000,
    });
  }

  /**
    Constructs a request that looks like:
    {
      "event": "unsubscribe",
      "pair": ["XBT/USD","BCH/USD"]
      "subscription": {
        "name": "trade"
      }
    }
   */
  _sendUnsubLevel2Updates() {
    this._debounceSend("unsub-l2updates", this._level2UpdateSubs, false, { name: "book" });
  }

  /**
    Handle for incoming messages
    @param {string} raw
   */
  _onMessage(raw) {
    let msgs = JSON.parse(raw);
    this._processsMessage(msgs);
  }

  /**
    When a subscription is initiated, a subscriptionStatus event is sent.
    This message will be cached in the subscriptionLog for look up later.
    When messages arrive, they only contain the subscription id.  The
    id is used to look up the subscription details in the subscriptionLog
    to determine what the message means.
   */
  _processsMessage(msg) {
    if (msg.event === "heartbeat") {
      return;
    }

    if (msg.event === "systemStatus") {
      return;
    }

    // Capture the subscription metadata for use later.
    if (msg.event === "subscriptionStatus") {
      /*
        {
          channelID: '15',
          event: 'subscriptionStatus',
          pair: 'XBT/EUR',
          status: 'subscribed',
          subscription: { name: 'ticker' }
        }
      */
      this.subscriptionLog.set(parseInt(msg.channelID), msg);
      return;
    }

    // All messages from this point forward should arrive as an array
    if (!Array.isArray(msg)) {
      return;
    }

    let [subscriptionId, details] = msg;
    let sl = this.subscriptionLog.get(subscriptionId);

    // If we don't have a subscription log entry for this event then
    // we need to abort since we don't know what to do with it!

    // From the subscriptionLog entry's pair, we can convert
    // the ws symbol into a rest symbol
    let remote_id = this.fromWsMap.get(sl.pair);

    // tickers
    if (sl.subscription.name === "ticker") {
      let market = this._tickerSubs.get(remote_id);
      if (!market) return;

      let ticker = this._constructTicker(details, market);
      if (ticker) {
        this.emit("ticker", ticker, market);
      }
      return;
    }

    // trades
    if (sl.subscription.name === "trade") {
      if (Array.isArray(msg[1])) {
        let market = this._tradeSubs.get(remote_id);
        if (!market) return;

        msg[1].forEach(t => {
          let trade = this._constructTrade(t, market);
          if (trade) {
            this.emit("trade", trade, market);
          }
        });
      }
      return;
    }

    //l2 updates
    if (sl.subscription.name === "book") {
      let market = this._level2UpdateSubs.get(remote_id);
      if (!market) return;

      // snapshot use as/bs
      // updates us a/b
      let isSnapshot = !!msg[1].as;
      if (isSnapshot) {
        let l2snapshot = this._constructLevel2Snapshot(msg[1], market);
        if (l2snapshot) {
          this.emit("l2snapshot", l2snapshot, market);
        }
      } else {
        let l2update = this._constructLevel2Update(msg[1], market);
        if (l2update) {
          this.emit("l2update", l2update, market);
        }
      }
    }
    return;
  }

  /**
    Refer to https://www.kraken.com/en-us/features/websocket-api#message-ticker
   */
  _constructTicker(msg, market) {
    /*
      { a: [ '3343.70000', 1, '1.03031692' ],
        b: [ '3342.20000', 1, '1.00000000' ],
        c: [ '3343.70000', '0.01000000' ],
        v: [ '4514.26000539', '7033.48119179' ],
        p: [ '3357.13865', '3336.28299' ],
        t: [ 14731, 22693 ],
        l: [ '3308.40000', '3223.90000' ],
        h: [ '3420.00000', '3420.00000' ],
        o: [ '3339.40000', '3349.00000' ] }
    */

    // calculate change and change percent based from the open/close
    // prices
    let open = parseFloat(msg.o[1]);
    let last = parseFloat(msg.c[0]);
    let change = open - last;
    let changePercent = ((last - open) / open) * 100;

    // calculate the quoteVolume by multiplying the volume
    // over the last 24h by the 24h vwap
    let quoteVolume = parseFloat(msg.v[1]) * parseFloat(msg.p[1]);

    return new Ticker({
      exchange: "Kraken",
      base: market.base,
      quote: market.quote,
      timestamp: Date.now(),
      last: msg.c[0],
      open: msg.o[1],
      high: msg.h[0],
      low: msg.l[0],
      volume: msg.v[1],
      quoteVolume: quoteVolume.toFixed(8),
      change: change.toFixed(8),
      changePercent: changePercent.toFixed(2),
      bid: msg.b[0],
      bidVolume: msg.b[2],
      ask: msg.a[0],
      askVolume: msg.a[2],
    });
  }

  /**
    Refer to https://www.kraken.com/en-us/features/websocket-api#message-trade

    Since Kraken doesn't send a trade Id we create a surrogate from
    the time stamp. This can result in duplicate trade Ids being generated.
    Additionaly mechanism will need to be put into place by the consumer to
    dedupe them.
   */
  _constructTrade(datum, market) {
    /*
    [ '3363.20000', '0.05168143', '1551432237.079148', 'b', 'l', '' ]
    */
    let side = datum[3] === "b" ? "buy" : "sell";

    // see above
    let tradeId = this._createTradeId(datum[2]);

    // convert to ms timestamp as an int
    let unix = parseInt(parseFloat(datum[2]) * 1000);

    return new Trade({
      exchange: "Kraken",
      base: market.base,
      quote: market.quote,
      tradeId,
      side: side,
      unix,
      price: datum[0],
      amount: datum[1],
      rawUnix: datum[2],
    });
  }

  /**
    Refer to https://www.kraken.com/en-us/features/websocket-api#message-book
   */
  _constructLevel2Update(datum, market) {
    /*
      [ 13, { a: [ [Array] ] }, { b: [ [Array], [Array] ] } ]
      Array = '3361.30000', '25.49061583', '1551438551.775384'
    */
    let a = datum.a ? datum.a : [];
    let b = datum.b ? datum.b : [];

    // collapse all timestamps into a single array
    let timestamps = a.map(p => parseFloat(p[2])).concat(b.map(p => parseFloat(p[2])));

    // then find the max value of all the timestamps
    let timestamp = Math.max.apply(null, timestamps);

    let asks = a.map(p => new Level2Point(p[0], p[1]));
    let bids = b.map(p => new Level2Point(p[0], p[1]));

    if (!asks.length && !bids.length) return;

    return new Level2Update({
      exchange: "Kraken",
      base: market.base,
      quote: market.quote,
      timestampMs: parseInt(timestamp * 1000),
      asks,
      bids,
    });
  }

  /**
    Refer to https://www.kraken.com/en-us/features/websocket-api#message-book
   */
  _constructLevel2Snapshot(datum, market) {
    /*
      {
        as: [
          [ '3361.30000', '25.57512297', '1551438550.367822' ],
          [ '3363.80000', '15.81228000', '1551438539.149525' ]
        ],
        bs: [
          [ '3361.20000', '0.07234101', '1551438547.041624' ],
          [ '3357.60000', '1.75000000', '1551438516.825218' ]
        ]
      }
    */

    let as = datum.as ? datum.as : [];
    let bs = datum.bs ? datum.bs : [];

    // collapse all timestamps into a single array
    let timestamps = as.map(p => parseFloat(p[2])).concat(bs.map(p => parseFloat(p[2])));

    // then find the max value of all the timestamps
    let timestamp = Math.max.apply(null, timestamps);

    let asks = datum.as.map(p => new Level2Point(p[0], p[1]));
    let bids = datum.bs.map(p => new Level2Point(p[0], p[1]));

    return new Level2Snapshot({
      exchange: "Kraken",
      base: market.base,
      quote: market.quote,
      timestampMs: parseInt(timestamp * 1000),
      asks,
      bids,
    });
  }

  /**
    Since Kraken doesn't send a trade id, we need to come up with a way
    to generate one on our own. The REST API include the last trade id
    which gives us the clue that it is the second timestamp + 9 sub-second
    digits.

    The WS will provide timestamps with up to 6 decimals of precision.
    The REST API only has timestamps with 4 decimal of precision.

    To maintain consistency, we're going to use the following formula:
      <integer part of unix timestamp> +
      <first 4 digits of fractional part of unix timestamp> +
      00000


    We're using the ROUND_HALF_UP method. From testing, this resulted
    in the best rounding results. Ids are in picoseconds, the websocket
    is broadcast in microsecond, and the REST results are truncated to
    4 decimals.

    This mean it is impossible to determine the rounding algorithm or
    the proper rounding to go from 6 to 4 decimals as the 6 decimals
    are being rounded from 9 which causes issues as the half
    point for 4 digit rounding
      .222950 rounds up to .2230 if the pico_ms value is > .222295000
      .222950 rounds down to .2229 if the pico_ms value is < .222295000

    Consumer code will need to account for collisions and id mismatch.
   */
  _createTradeId(unix) {
    let roundMode = Decimal.ROUND_HALF_UP;
    let [integer, frac] = unix.split(".");
    let fracResult = new Decimal("0." + frac)
      .toDecimalPlaces(4, roundMode)
      .toFixed(4)
      .split(".")[1];
    return integer + fracResult + "00000";
  }
}

module.exports = KrakenClient;
