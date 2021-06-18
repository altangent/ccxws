/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */

import zlib from "zlib";
import { IClient } from "../IClient";
import { EventEmitter } from "events";
import { Watcher } from "../Watcher";
import { BasicClient } from "../BasicClient";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Candle } from "../Candle";
import { SubscriptionType } from "../SubscriptionType";
import { CandlePeriod } from "../CandlePeriod";
import { throttle } from "../flowcontrol/Throttle";
import { wait } from "../Util";
import { Market } from "../Market";
import { CancelableFn } from "../flowcontrol/Fn";
import { NotImplementedAsyncFn, NotImplementedFn } from "../NotImplementedFn";

export type BatchedClient = IClient & {
    parent?: IClient;
    subCount?: number;
};

export class BiboxClient extends EventEmitter implements IClient {
    public readonly throttleMs: number;
    public readonly timeoutMs: number;
    public readonly subsPerClient: number;
    public readonly options: any;

    public readonly hasTickers: boolean;
    public readonly hasTrades: boolean;
    public readonly hasCandles: boolean;
    public readonly hasLevel2Snapshots: boolean;
    public readonly hasLevel2Updates: boolean;
    public readonly hasLevel3Snapshots: boolean;
    public readonly hasLevel3Updates: boolean;

    public candlePeriod: CandlePeriod;

    protected _subClients: Map<string, BiboxBasicClient>;
    protected _clients: BiboxBasicClient[];
    protected _subscribe: CancelableFn;

    public subscribeLevel2Updates = NotImplementedFn;
    public unsubscribeLevel2Updates = NotImplementedAsyncFn;
    public subscribeLevel3Snapshots = NotImplementedFn;
    public unsubscribeLevel3Snapshots = NotImplementedAsyncFn;
    public subscribeLevel3Updates = NotImplementedFn;
    public unsubscribeLevel3Updates = NotImplementedFn;

    /**
    Bibox allows listening to multiple markets on the same
    socket. Unfortunately, they throw errors if you subscribe
    to too more than 20 markets at a time re:
    https://github.com/Biboxcom/API_Docs_en/wiki/WS_request#1-access-to-the-url
    This makes like hard and we need to batch connections, which
    is why we can't use the BasicMultiClient.
   */
    constructor(options?: any) {
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
        this._subscribe = throttle(this.__subscribe.bind(this), this.throttleMs);
        this.candlePeriod = CandlePeriod._1m;
    }

    public subscribeTicker(market: Market) {
        this._subscribe(market, SubscriptionType.ticker);
    }

    public async unsubscribeTicker(market) {
        this._unsubscribe(market, SubscriptionType.ticker);
    }

    public subscribeTrades(market) {
        this._subscribe(market, SubscriptionType.trade);
    }

    public unsubscribeTrades(market) {
        this._unsubscribe(market, SubscriptionType.trade);
    }

    public subscribeCandles(market) {
        this._subscribe(market, SubscriptionType.candle);
    }

    public async unsubscribeCandles(market) {
        this._unsubscribe(market, SubscriptionType.candle);
    }

    public async subscribeLevel2Snapshots(market) {
        this._subscribe(market, SubscriptionType.level2snapshot);
    }

    public async unsubscribeLevel2Snapshots(market) {
        this._unsubscribe(market, SubscriptionType.level2snapshot);
    }

    public close() {
        this._subscribe.cancel();

        for (const client of this._clients) {
            client.close();
        }
    }

    public async reconnect() {
        for (const client of this._clients) {
            client.reconnect();
            await wait(this.timeoutMs);
        }
    }

    protected __subscribe(market: Market, subscriptionType: SubscriptionType) {
        // construct the subscription key from the remote_id and the type
        // of subscription being performed
        const subKey = market.id + "_" + subscriptionType;

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
            client.on("connecting", () => this.emit("connecting", market, subscriptionType));
            client.on("connected", () => this.emit("connected", market, subscriptionType));
            client.on("disconnected", () => this.emit("disconnected", market, subscriptionType));
            client.on("reconnecting", () => this.emit("reconnecting", market, subscriptionType));
            client.on("closing", () => this.emit("closing", market, subscriptionType));
            client.on("closed", () => this.emit("closed", market, subscriptionType));
            client.on("ticker", (ticker, market) => this.emit("ticker", ticker, market));
            client.on("trade", (trade, market) => this.emit("trade", trade, market));
            client.on("candle", (candle, market) => this.emit("candle", candle, market));
            client.on("l2snapshot", (l2snapshot, market) =>
                this.emit("l2snapshot", l2snapshot, market),
            );
            client.on("error", err => this.emit("error", err));

            // push it into the list of clients
            this._clients.push(client);

            // make sure we set the value
            this._subClients.set(subKey, client);
        }

        // now that we have a client, call the sub method, which
        // should be an idempotent method, so no harm in calling it again
        switch (subscriptionType) {
            case SubscriptionType.ticker:
                client.subscribeTicker(market);
                break;
            case SubscriptionType.trade:
                client.subscribeTrades(market);
                break;
            case SubscriptionType.candle:
                client.subscribeCandles(market);
                break;
            case SubscriptionType.level2snapshot:
                client.subscribeLevel2Snapshots(market);
                break;
        }
    }

    protected _unsubscribe(market: Market, subscriptionType: SubscriptionType) {
        // construct the subscription key from the remote_id and the type
        // of subscription being performed
        const subKey = market.id + "_" + subscriptionType;

        // find the client
        const client = this._subClients.get(subKey);

        // abort if nothign to do
        if (!client) return;

        // perform the unsubscribe operation
        switch (subscriptionType) {
            case SubscriptionType.ticker:
                client.unsubscribeTicker(market);
                break;
            case SubscriptionType.trade:
                client.unsubscribeTrades(market);
                break;
            case SubscriptionType.candle:
                client.unsubscribeCandles(market);
                break;
            case SubscriptionType.level2snapshot:
                client.unsubscribeLevel2Snapshots(market);
                break;
        }

        // remove the client if nothing left to do
        if (client.subCount === 0) {
            client.close();
            const idx = this._clients.indexOf(client);
            this._clients.splice(idx, 1);
        }
    }
}

export class BiboxBasicClient extends BasicClient {
    public subCount: number;
    public parent: BiboxClient;

    protected _sendSubLevel2Updates = NotImplementedFn;
    protected _sendUnsubLevel2Updates = NotImplementedAsyncFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedAsyncFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedAsyncFn;

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

    public get candlePeriod(): CandlePeriod {
        return this.parent.candlePeriod;
    }

    /**
    Server will occassionally send ping messages. Client is expected
    to respond with a pong message that matches the identifier.
    If client fails to do this, server will abort connection after
    second attempt.
   */
    protected _sendPong(id) {
        this._wss.send(JSON.stringify({ pong: id }));
    }

    protected _sendSubTicker(remote_id: string) {
        this.subCount++;
        this._wss.send(
            JSON.stringify({
                event: "addChannel",
                channel: `bibox_sub_spot_${remote_id}_ticker`,
            }),
        );
    }

    protected async _sendUnsubTicker(remote_id: string) {
        this.subCount--;
        this._wss.send(
            JSON.stringify({
                event: "removeChannel",
                channel: `bibox_sub_spot_${remote_id}_ticker`,
            }),
        );
    }

    protected async _sendSubTrades(remote_id: string) {
        this.subCount++;
        this._wss.send(
            JSON.stringify({
                event: "addChannel",
                channel: `bibox_sub_spot_${remote_id}_deals`,
            }),
        );
    }

    protected _sendUnsubTrades(remote_id: string) {
        this.subCount--;
        this._wss.send(
            JSON.stringify({
                event: "removeChannel",
                channel: `bibox_sub_spot_${remote_id}_deals`,
            }),
        );
    }

    protected _sendSubCandles(remote_id) {
        this.subCount++;
        this._wss.send(
            JSON.stringify({
                event: "addChannel",
                channel: `bibox_sub_spot_${remote_id}_kline_${candlePeriod(this.candlePeriod)}`,
            }),
        );
    }

    protected async _sendUnsubCandles(remote_id) {
        this.subCount--;
        this._wss.send(
            JSON.stringify({
                event: "removeChannel",
                channel: `bibox_sub_spot_${remote_id}_kline_${candlePeriod(this.candlePeriod)}`,
            }),
        );
    }

    protected async _sendSubLevel2Snapshots(remote_id) {
        this.subCount++;
        this._wss.send(
            JSON.stringify({
                event: "addChannel",
                channel: `bibox_sub_spot_${remote_id}_depth`,
            }),
        );
    }

    protected async _sendUnsubLevel2Snapshots(remote_id) {
        this.subCount--;
        this._wss.send(
            JSON.stringify({
                event: "removeChannel",
                channel: `bibox_sub_spot_${remote_id}_depth`,
            }),
        );
    }

    /**
    Message usually arives as a string, that must first be converted
    to JSON. Then we can process each message in the payload and
    perform gunzip on the data.
   */
    protected _onMessage(raw: any) {
        const msgs = typeof raw == "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(msgs)) {
            for (const msg of msgs) {
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
    protected _processsMessage(msg: any) {
        // if we detect gzip data, we need to process it
        if (msg.binary == 1) {
            const buffer = zlib.gunzipSync(Buffer.from(msg.data, "base64"));
            msg.data = JSON.parse(buffer.toString());
        }

        // server will occassionally send a ping message and client
        // must respon with appropriate identifier
        if (msg.ping) {
            this._sendPong(msg.ping);
            return;
        }

        // watch for error messages
        if (msg.error) {
            const err = new Error(msg.error);
            err.message = msg;
            this.emit("error", err);
            return;
        }

        if (!msg.channel) {
            return;
        }

        if (msg.channel.endsWith("_deals")) {
            // trades are send in descendinging order
            // out library standardize to asc order so perform a reverse
            const data = msg.data.slice().reverse();
            for (const datum of data) {
                const market = this._tradeSubs.get(datum.pair);
                if (!market) return;

                const trade = this._constructTradesFromMessage(datum, market);
                this.emit("trade", trade, market);
            }
            return;
        }

        // tickers
        if (msg.channel.endsWith("_ticker")) {
            const market = this._tickerSubs.get(msg.data.pair);
            if (!market) return;

            const ticker = this._constructTicker(msg, market);
            this.emit("ticker", ticker, market);
            return;
        }

        // l2 updates
        if (msg.channel.endsWith("depth")) {
            const remote_id = msg.data.pair;
            const market =
                this._level2SnapshotSubs.get(remote_id) || this._level2UpdateSubs.get(remote_id);
            if (!market) return;

            const snapshot = this._constructLevel2Snapshot(msg, market);
            this.emit("l2snapshot", snapshot, market);
            return;
        }

        // candle
        if (msg.channel.endsWith(`kline_${candlePeriod(this.candlePeriod)}`)) {
            // bibox_sub_spot_BTC_USDT_kline_1min
            const remote_id = msg.channel
                .replace("bibox_sub_spot_", "")
                .replace(`_kline_${candlePeriod(this.candlePeriod)}`, "");

            const market = this._candleSubs.get(remote_id);
            if (!market) return;

            for (const datum of msg.data) {
                const candle = this._constructCandle(datum);
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
    protected _constructTicker(msg: any, market: Market) {
        let { last, buy, sell, vol, percent, low, high, timestamp } = msg.data;

        percent = percent.replace(/%|\+/g, "");
        const change = (parseFloat(last) * parseFloat(percent)) / 100;
        const open = parseFloat(last) - change;

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
    protected _constructTradesFromMessage(datum: any, market: Market) {
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
    protected _constructCandle(datum: any) {
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
    protected _constructLevel2Snapshot(msg: any, market: Market) {
        const asks = msg.data.asks.map(p => new Level2Point(p.price, p.volume));
        const bids = msg.data.bids.map(p => new Level2Point(p.price, p.volume));
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
        case CandlePeriod._15m:
            return "15min";
        case CandlePeriod._30m:
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
