/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Decimal from "decimal.js";
import { BasicClient, MarketMap } from "../BasicClient";
import { Candle } from "../Candle";
import { CandlePeriod } from "../CandlePeriod";
import { ClientOptions } from "../ClientOptions";
import * as https from "../Https";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Level2Update } from "../Level2Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export type KrakenClientOptions = ClientOptions & { autoloadSymbolMaps?: boolean };

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
export class KrakenClient extends BasicClient {
    public candlePeriod: CandlePeriod;
    public bookDepth: number;
    public debounceWait: number;

    protected debouceTimeoutHandles: Map<string, NodeJS.Timeout>;
    protected subscriptionLog: Map<number, any>;
    protected fromRestMap: Map<string, string>;
    protected fromWsMap: Map<string, string>;

    constructor({
        wssPath = "wss://ws.kraken.com",
        autoloadSymbolMaps = true,
        watcherMs,
    }: KrakenClientOptions = {}) {
        super(wssPath, "Kraken", undefined, watcherMs);

        this.hasTickers = true;
        this.hasTrades = true;
        this.hasCandles = true;
        this.hasLevel2Updates = true;
        this.hasLevel2Snapshots = false;

        this.candlePeriod = CandlePeriod._1m;
        this.bookDepth = 500;

        this.subscriptionLog = new Map();
        this.debouceTimeoutHandles = new Map();
        this.debounceWait = 200;

        this.fromRestMap = new Map();
        this.fromWsMap = new Map();

        if (autoloadSymbolMaps) {
            this.loadSymbolMaps().catch(err => this.emit("error", err));
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
    public async loadSymbolMaps() {
        const uri = "https://api.kraken.com/0/public/AssetPairs";
        const { result } = await https.get(uri);
        for (const symbol in result) {
            const restName = symbol;
            const wsName = result[symbol].wsname;
            if (wsName) {
                this.fromRestMap.set(restName, wsName);
                this.fromWsMap.set(wsName, restName);
            }
        }
    }

    /**
    Helper that retrieves the list of ws symbols from the supplied
    subscription map. The BasicClient manages the subscription maps
    when subscribe<Trade|Ticker|etc> is called and adds the records.
    This helper will take the values in a subscription map and
    convert them into the websocket symbols, ensuring that markets
    that are not mapped do not get included in the list.

    @param map subscription map such as _tickerSubs or _tradeSubs
   */
    protected _wsSymbolsFromSubMap(map: MarketMap) {
        const restSymbols = Array.from(map.keys());
        return restSymbols.map(p => this.fromRestMap.get(p)).filter(p => p);
    }

    /**
    Debounce is used to throttle a function that is repeatedly called. This
    is applicable when many calls to subscribe or unsubscribe are executed
    in quick succession by the calling application.
   */
    protected _debounce(type: string, fn: () => void) {
        clearTimeout(this.debouceTimeoutHandles.get(type));
        this.debouceTimeoutHandles.set(type, setTimeout(fn, this.debounceWait));
    }

    /**
    This method is called by each of the _send* methods.  It uses
    a debounce function on a given key so we can batch send the request
    with the active symbols. We also need to convert the rest symbols
    provided by the caller into websocket symbols used by the Kraken
    ws server.

    @param debounceKey unique key for the caller so each call
    is debounced with related calls
    @param subMap subscription map storing the current subs
    for the type, such as _tickerSubs, _tradeSubs, etc.
    @param subscribe true for subscribe, false for unsubscribe
    @param subscription the subscription name passed to the
    JSON-RPC call
   */
    protected _debounceSend(
        debounceKey: string,
        subMap: MarketMap,
        subscribe: boolean,
        subscription: { name: string; [x: string]: any },
    ) {
        this._debounce(debounceKey, () => {
            const wsSymbols = this._wsSymbolsFromSubMap(subMap);
            if (!this._wss) return;
            this._wss.send(
                JSON.stringify({
                    event: subscribe ? "subscribe" : "unsubscribe",
                    pair: wsSymbols,
                    subscription,
                }),
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
    protected _sendSubTicker() {
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
    protected _sendUnsubTicker() {
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
    protected _sendSubTrades() {
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
    protected _sendUnsubTrades() {
        this._debounceSend("unsub-trades", this._tradeSubs, false, { name: "trade" });
    }

    /**
   * Constructs a request that looks like:
    {
      "event": "unsubscribe",
      "pair": ["XBT/USD","BCH/USD"]
      "subscription": {
        "name": "ohlc"
        "interval": 1
      }
    }
   */
    protected _sendSubCandles() {
        const interval = getCandlePeriod(this.candlePeriod);
        this._debounceSend("sub-candles", this._candleSubs, true, { name: "ohlc", interval });
    }

    /**
   * Constructs a request that looks like:
    {
      "event": "unsubscribe",
      "pair": ["XBT/USD","BCH/USD"]
      "subscription": {
        "name": "ohlc"
        "interval": 1
      }
    }
   */
    protected _sendUnsubCandles() {
        const interval = getCandlePeriod(this.candlePeriod);
        this._debounceSend("unsub-candles", this._candleSubs, false, { name: "ohlc", interval });
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
    protected _sendSubLevel2Updates() {
        this._debounceSend("sub-l2updates", this._level2UpdateSubs, true, {
            name: "book",
            depth: this.bookDepth,
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
    protected _sendUnsubLevel2Updates() {
        this._debounceSend("unsub-l2updates", this._level2UpdateSubs, false, { name: "book" });
    }

    /**
    Handle for incoming messages
    @param raw
   */
    protected _onMessage(raw: string) {
        const msgs = JSON.parse(raw);
        this._processsMessage(msgs);
    }

    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    /**
    When a subscription is initiated, a subscriptionStatus event is sent.
    This message will be cached in the subscriptionLog for look up later.
    When messages arrive, they only contain the subscription id.  The
    id is used to look up the subscription details in the subscriptionLog
    to determine what the message means.
   */
    protected _processsMessage(msg: any) {
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

        const [subscriptionId, details] = msg;
        const sl = this.subscriptionLog.get(subscriptionId);

        // If we don't have a subscription log entry for this event then
        // we need to abort since we don't know what to do with it!

        // From the subscriptionLog entry's pair, we can convert
        // the ws symbol into a rest symbol
        const remote_id = this.fromWsMap.get(sl.pair);

        // tickers
        if (sl.subscription.name === "ticker") {
            const market = this._tickerSubs.get(remote_id);
            if (!market) return;

            const ticker = this._constructTicker(details, market);
            if (ticker) {
                this.emit("ticker", ticker, market);
            }
            return;
        }

        // trades
        if (sl.subscription.name === "trade") {
            if (Array.isArray(msg[1])) {
                const market = this._tradeSubs.get(remote_id);
                if (!market) return;

                for (const t of msg[1]) {
                    const trade = this._constructTrade(t, market);
                    if (trade) {
                        this.emit("trade", trade, market);
                    }
                }
            }
            return;
        }

        // candles
        if (sl.subscription.name === "ohlc") {
            const market = this._candleSubs.get(remote_id);
            if (!market) return;

            const candle = this._constructCandle(msg);
            this.emit("candle", candle, market);
            return;
        }

        //l2 updates
        if (sl.subscription.name === "book") {
            const market = this._level2UpdateSubs.get(remote_id);
            if (!market) return;

            // snapshot use as/bs
            // updates us a/b
            const isSnapshot = !!msg[1].as;
            if (isSnapshot) {
                const l2snapshot = this._constructLevel2Snapshot(msg[1], market);
                if (l2snapshot) {
                    this.emit("l2snapshot", l2snapshot, market, msg);
                }
            } else {
                const l2update = this._constructLevel2Update(msg, market);
                if (l2update) {
                    this.emit("l2update", l2update, market, msg);
                }
            }
        }
        return;
    }

    /**
    Refer to https://www.kraken.com/en-us/features/websocket-api#message-ticker
   */
    protected _constructTicker(msg, market) {
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
        const open = parseFloat(msg.o[1]);
        const last = parseFloat(msg.c[0]);
        const change = open - last;
        const changePercent = ((last - open) / open) * 100;

        // calculate the quoteVolume by multiplying the volume
        // over the last 24h by the 24h vwap
        const quoteVolume = parseFloat(msg.v[1]) * parseFloat(msg.p[1]);

        return new Ticker({
            exchange: this.name,
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
    protected _constructTrade(datum, market) {
        /*
    [ '3363.20000', '0.05168143', '1551432237.079148', 'b', 'l', '' ]
    */
        const side = datum[3] === "b" ? "buy" : "sell";

        // see above
        const tradeId = this._createTradeId(datum[2]);

        // convert to ms timestamp as an int
        const unix = parseInt((parseFloat(datum[2]) * 1000) as any);

        return new Trade({
            exchange: this.name,
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
    Refer to https://www.kraken.com/en-us/features/websocket-api#message-ohlc
   */
    protected _constructCandle(msg) {
        /**
      [
        6,
        [ '1571080988.157759',
          '1571081040.000000',
          '8352.00000',
          '8352.00000',
          '8352.00000',
          '8352.00000',
          '8352.00000',
          '0.01322211',
          1
        ],
        'ohlc-1',
        'XBT/USD'
      ]
      */
        const datum = msg[1];
        const ms = parseInt(datum[1]) * 1000;
        return new Candle(ms, datum[2], datum[3], datum[4], datum[5], datum[7]);
    }

    /**
     * Refer to https://www.kraken.com/en-us/features/websocket-api#message-book
     * Values will look like:
     * [
     *    270,
     *    {"b":[["11260.50000","0.00000000","1596221402.104952"],["11228.70000","2.60111463","1596221103.546084","r"]],"c":"1281654047"},
     *    "book-100",
     *    "XBT/USD"
     * ]
     *
     * [
     *    270,
     *    {"a":[["11277.30000","1.01949833","1596221402.163693"]]},
     *    {"b":[["11275.30000","0.17300000","1596221402.163680"]],"c":"1036980588"},
     *    "book-100",
     *    "XBT/USD"
     * ]
     */
    protected _constructLevel2Update(msg, market) {
        const asks = [];
        const bids = [];
        let checksum;

        // Because some messages will send more than a single result object
        // we need to iterate the results blocks starting at position 1 and
        // look for ask, bid, and checksum data.
        for (let i = 1; i < msg.length; i++) {
            // Process ask updates
            if (msg[i].a) {
                for (const [price, size, timestamp] of msg[i].a) {
                    asks.push(new Level2Point(price, size, undefined, undefined, timestamp));
                }
            }

            // Process bid updates
            if (msg[i].b) {
                for (const [price, size, timestamp] of msg[i].b) {
                    bids.push(new Level2Point(price, size, undefined, undefined, timestamp));
                }
            }

            // Process checksum
            if (msg[i].c) {
                checksum = msg[i].c;
            }
        }

        // Calculates the newest timestamp value to maintain backwards
        // compatibility with the update timestamp
        const timestamp = Math.max(...asks.concat(bids).map(p => parseFloat(p.timestamp)));

        return new Level2Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs: parseInt((timestamp * 1000) as any),
            asks,
            bids,
            checksum,
        });
    }

    /**
     * Refer to https://www.kraken.com/en-us/features/websocket-api#message-book
     *
     *   {
     *     as: [
     *       [ '3361.30000', '25.57512297', '1551438550.367822' ],
     *       [ '3363.80000', '15.81228000', '1551438539.149525' ]
     *     ],
     *     bs: [
     *       [ '3361.20000', '0.07234101', '1551438547.041624' ],
     *       [ '3357.60000', '1.75000000', '1551438516.825218' ]
     *     ]
     *   }
     */
    protected _constructLevel2Snapshot(datum, market) {
        // Process asks
        const as = datum.as || [];
        const asks = [];
        for (const [price, size, timestamp] of as) {
            asks.push(new Level2Point(price, size, undefined, undefined, timestamp));
        }

        // Process bids
        const bs = datum.bs || [];
        const bids = [];
        for (const [price, size, timestamp] of bs) {
            bids.push(new Level2Point(price, size, undefined, undefined, timestamp));
        }

        // Calculates the newest timestamp value to maintain backwards
        // compatibility with the update timestamp
        const timestamp = Math.max(...asks.concat(bids).map(p => parseFloat(p.timestamp)));

        return new Level2Snapshot({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs: parseInt((timestamp * 1000) as any),
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
    protected _createTradeId(unix: string): string {
        const roundMode = Decimal.ROUND_HALF_UP;
        const [integer, frac] = unix.split(".");
        const fracResult = new Decimal("0." + frac)
            .toDecimalPlaces(4, roundMode)
            .toFixed(4)
            .split(".")[1];
        return integer + fracResult + "00000";
    }
}

/**
 * Maps the candle period from CCXWS to those required by the subscription mechanism
 * as defined in https://www.kraken.com/en-us/features/websocket-api#message-subscribe
 * @paramp
 */
function getCandlePeriod(p: CandlePeriod) {
    switch (p) {
        case CandlePeriod._1m:
            return 1;
        case CandlePeriod._5m:
            return 5;
        case CandlePeriod._15m:
            return 15;
        case CandlePeriod._30m:
            return 30;
        case CandlePeriod._1h:
            return 60;
        case CandlePeriod._4h:
            return 240;
        case CandlePeriod._1d:
            return 1440;
        case CandlePeriod._1w:
            return 10080;
        case CandlePeriod._2w:
            return 21600;
    }
}
