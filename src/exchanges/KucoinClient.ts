/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-implied-eval */
import { BasicClient } from "../BasicClient";
import { CandlePeriod } from "../CandlePeriod";
import { ClientOptions } from "../ClientOptions";
import { CancelableFn } from "../flowcontrol/Fn";
import { wait } from "../Util";
import crypto from "crypto";
import { Trade } from "../Trade";
import { Candle } from "../Candle";
import { Ticker } from "../Ticker";
import { Level2Point } from "../Level2Point";
import { Level2Update } from "../Level2Update";
import { Market } from "../Market";
import { Level2Snapshot } from "../Level2Snapshots";
import * as https from "../Https";
import { Level3Update } from "../Level3Update";
import { throttle } from "../flowcontrol/Throttle";
import { Level3Point } from "../Level3Point";
import { Level3Snapshot } from "../Level3Snapshot";
import { NotImplementedFn } from "../NotImplementedFn";

export type KucoinClientOptions = ClientOptions & {
    sendThrottleMs?: number;
    restThrottleMs?: number;
};

/**
 * Kucoin client has a hard limit of 100 subscriptions per socket connection.
 * When more than 100 subscriptions are made on a single socket it will generate
 * an error that says "509: exceed max subscription count limitation of 100 per session".
 * To work around this will require creating multiple clients if you makem ore than 100
 * subscriptions.
 */
export class KucoinClient extends BasicClient {
    public candlePeriod: CandlePeriod;
    public readonly restThrottleMs: number;
    public readonly connectInitTimeoutMs: number;

    protected _pingIntervalTime: number;
    protected _connectId: string;
    protected _sendMessage: CancelableFn;
    protected _requestLevel2Snapshot: CancelableFn;
    protected _requestLevel3Snapshot: CancelableFn;
    protected _pingInterval: NodeJS.Timeout;

    constructor({
        wssPath,
        watcherMs,
        sendThrottleMs = 10,
        restThrottleMs = 250,
    }: KucoinClientOptions = {}) {
        super(wssPath, "KuCoin", undefined, watcherMs);
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasCandles = true;
        this.hasLevel2Snapshots = false;
        this.hasLevel2Updates = true;
        this.hasLevel3Updates = false;
        this.candlePeriod = CandlePeriod._1m;
        this._pingIntervalTime = 50000;
        this.restThrottleMs = restThrottleMs;
        this.connectInitTimeoutMs = 5000;
        this._sendMessage = throttle(this.__sendMessage.bind(this), sendThrottleMs);
        this._requestLevel2Snapshot = throttle(
            this.__requestLevel2Snapshot.bind(this),
            restThrottleMs,
        );
        this._requestLevel3Snapshot = throttle(
            this.__requestLevel3Snapshot.bind(this),
            restThrottleMs,
        );
    }

    protected _beforeClose() {
        this._sendMessage.cancel();
        this._requestLevel2Snapshot.cancel();
        this._requestLevel3Snapshot.cancel();
    }

    protected _beforeConnect() {
        this._wss.on("connected", this._startPing.bind(this));
        this._wss.on("disconnected", this._stopPing.bind(this));
        this._wss.on("closed", this._stopPing.bind(this));
    }

    protected _startPing() {
        clearInterval(this._pingInterval);
        this._pingInterval = setInterval(this._sendPing.bind(this), this._pingIntervalTime);
    }

    protected _stopPing() {
        clearInterval(this._pingInterval);
    }

    protected _sendPing() {
        if (this._wss) {
            this._wss.send(
                JSON.stringify({
                    id: new Date().getTime(),
                    type: "ping",
                }),
            );
        }
    }

    /**
     * Kucoin requires a token that is obtained from a REST endpoint. We make the synchronous
     * _connect method create a temporary _wss instance so that subsequent calls to _connect
     * are idempotent and only a single socket connection is created. Then the _connectAsync
     * call is performed that does the REST token fetching and the connection.
     */
    protected _connect() {
        if (!this._wss) {
            this._wss = { status: "connecting" } as any;
            if (this.wssPath) super._connect();
            else this._connectAsync();
        }
    }

    protected async _connectAsync() {
        let wssPath;

        // Retry http request until successful
        while (!wssPath) {
            try {
                const raw: any = await https.post("https://openapi-v2.kucoin.com/api/v1/bullet-public"); // prettier-ignore
                if (!raw.data || !raw.data.token) throw new Error("Unexpected token response");
                const { token, instanceServers } = raw.data;
                const { endpoint, pingInterval } = instanceServers[0];
                this._connectId = crypto.randomBytes(24).toString("hex");
                this._pingIntervalTime = pingInterval;
                wssPath = `${endpoint}?token=${token}&connectId=${this._connectId}`;
            } catch (ex) {
                this._onError(ex);
                await wait(this.connectInitTimeoutMs);
            }
        }

        // Construct a socket and bind all events
        this._wss = this._wssFactory(wssPath);
        this._wss.on("error", this._onError.bind(this));
        this._wss.on("connecting", this._onConnecting.bind(this));
        this._wss.on("connected", this._onConnected.bind(this));
        this._wss.on("disconnected", this._onDisconnected.bind(this));
        this._wss.on("closing", this._onClosing.bind(this));
        this._wss.on("closed", this._onClosed.bind(this));
        this._wss.on("message", msg => {
            try {
                this._onMessage(msg);
            } catch (ex) {
                this._onError(ex);
            }
        });
        if (this._beforeConnect) this._beforeConnect();
        this._wss.connect();
    }

    protected __sendMessage(msg) {
        this._wss.send(msg);
    }

    protected _sendSubTicker(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "subscribe",
                topic: "/market/snapshot:" + remote_id,
                privateChannel: false,
                response: true,
            }),
        );
    }

    protected _sendUnsubTicker(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "unsubscribe",
                topic: "/market/snapshot:" + remote_id,
                privateChannel: false,
                response: true,
            }),
        );
    }

    protected _sendSubTrades(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "subscribe",
                topic: "/market/match:" + remote_id,
                privateChannel: false,
                response: true,
            }),
        );
    }

    protected _sendUnsubTrades(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "unsubscribe",
                topic: "/market/match:" + remote_id,
                privateChannel: false,
                response: true,
            }),
        );
    }

    protected _sendSubCandles(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "subscribe",
                topic: `/market/candles:${remote_id}_${candlePeriod(this.candlePeriod)}`,
                privateChannel: false,
                response: true,
            }),
        );
    }

    protected _sendUnsubCandles(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "unsubscribe",
                topic: `/market/candles:${remote_id}_${candlePeriod(this.candlePeriod)}`,
                privateChannel: false,
                response: true,
            }),
        );
    }

    protected _sendSubLevel2Updates(remote_id: string) {
        const market = this._level2UpdateSubs.get(remote_id);
        this._requestLevel2Snapshot(market);

        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "subscribe",
                topic: "/market/level2:" + remote_id,
                response: true,
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "unsubscribe",
                topic: "/market/level2:" + remote_id,
                response: true,
            }),
        );
    }

    protected _sendSubLevel3Updates(remote_id: string) {
        const market = this._level3UpdateSubs.get(remote_id);
        this._requestLevel3Snapshot(market);

        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "subscribe",
                topic: "/spotMarket/level3:" + remote_id,
                response: true,
            }),
        );
    }

    protected _sendUnsubLevel3Updates(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                id: new Date().getTime(),
                type: "unsubscribe",
                topic: "/spotMarket/level3:" + remote_id,
                response: true,
            }),
        );
    }

    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;

    protected _onMessage(raw: string) {
        const replaced = raw.replace(/:(\d+\.{0,1}\d+)(,|\})/g, ':"$1"$2');
        try {
            const msgs = JSON.parse(replaced);

            if (Array.isArray(msgs)) {
                for (const msg of msgs) {
                    this._processMessage(msg);
                }
            } else {
                this._processMessage(msgs);
            }
        } catch (ex) {
            this._onError(ex);
        }
    }

    protected _processMessage(msg) {
        if (msg.type === "ack") {
            return;
        }

        if (msg.type === "error") {
            const err: any = new Error(msg.data);
            err.msg = msg;
            this._onError(err);
            return;
        }

        // trades
        if (msg.subject === "trade.l3match") {
            this._processTrades(msg);
            return;
        }

        // candles
        if (msg.subject === "trade.candles.update") {
            this._processCandles(msg);
            return;
        }

        // tickers
        if (msg.subject === "trade.snapshot") {
            this._processTicker(msg);
            return;
        }

        // l2 updates
        if (msg.subject === "trade.l2update") {
            this._processL2Update(msg);
            return;
        }

        // l3 received
        if (msg.subject === "received") {
            this._processL3UpdateReceived(msg);
            return;
        }

        // l3 open
        if (msg.subject === "open") {
            this._processL3UpdateOpen(msg);
            return;
        }

        // l3 done
        if (msg.subject === "done") {
            this._processL3UpdateDone(msg);
            return;
        }

        // l3 match
        if (msg.subject === "match") {
            this._processL3UpdateMatch(msg);
            return;
        }

        // l3 change
        if (msg.subject === "update") {
            this._processL3UpdateUpdate(msg);
            return;
        }
    }

    protected _processTrades(msg: any) {
        let { symbol, time, side, size, price, tradeId, makerOrderId, takerOrderId } = msg.data;
        const market = this._tradeSubs.get(symbol);
        if (!market) {
            return;
        }

        if (time.length === 19) {
            time = time.substring(0, 13);
        }

        const trade = new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: tradeId,
            side: side,
            unix: parseInt(time),
            price: price,
            amount: size,
            buyOrderId: side === "buy" ? makerOrderId : takerOrderId,
            sellOrderId: side === "sell" ? makerOrderId : takerOrderId,
        });

        this.emit("trade", trade, market);
    }

    /**
    {
        "type":"message",
        "topic":"/market/candles:BTC-USDT_1hour",
        "subject":"trade.candles.update",
        "data":{

            "symbol":"BTC-USDT",    // symbol
            "candles":[

                "1589968800",   // Start time of the candle cycle
                "9786.9",       // open price
                "9740.8",       // close price
                "9806.1",       // high price
                "9732",         // low price
                "27.45649579",  // Transaction volume
                "268280.09830877"   // Transaction amount
            ],
            "time":1589970010253893337  // now（us）
        }
    }
   */
    protected _processCandles(msg: any) {
        const { symbol, candles } = msg.data;
        const market = this._candleSubs.get(symbol);
        if (!market) return;

        const result = new Candle(
            Number(candles[0] * 1000),
            candles[1],
            candles[3],
            candles[4],
            candles[2],
            candles[5],
        );
        this.emit("candle", result, market);
    }

    protected _processTicker(msg: any) {
        const {
            symbol,
            high,
            low,
            datetime,
            vol,
            lastTradedPrice,
            changePrice,
            changeRate,
            open,
            sell,
            buy,
        } = msg.data.data;
        const market = this._tickerSubs.get(symbol);

        if (!market) {
            return;
        }

        const ticker = new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp: parseFloat(datetime),
            last: lastTradedPrice,
            open: open,
            high: high,
            low: low,
            volume: vol,
            change: changePrice.toFixed ? changePrice.toFixed(8) : changePrice,
            changePercent: changeRate.toFixed ? changeRate.toFixed(2) : changeRate,
            bid: buy,
            ask: sell,
            bidVolume: undefined,
            quoteVolume: undefined,
            askVolume: undefined,
        });

        this.emit("ticker", ticker, market);
    }

    /**
    {
      "data":{
        "sequenceStart":"1584724386150",
        "symbol":"BTC-USDT",
        "changes":{
          "asks":[
            ["9642.7","0.386","1584724386150"]
          ],
          "bids":[]
        },
        "sequenceEnd":"1584724386150"
      },
      "subject":"trade.l2update",
      "topic":"/market/level2:BTC-USDT",
      "type":"message"
    }
   */
    protected _processL2Update(msg: any) {
        const { symbol, changes, sequenceStart, sequenceEnd } = msg.data;
        const market = this._level2UpdateSubs.get(symbol);

        if (!market) {
            return;
        }

        const asks = changes.asks.map(p => new Level2Point(p[0], p[1]));
        const bids = changes.bids.map(p => new Level2Point(p[0], p[1]));
        const lastSequenceId = Number(sequenceEnd);
        const l2Update = new Level2Update({
            exchange: "KuCoin",
            base: market.base,
            quote: market.quote,
            sequenceId: Number(sequenceStart),
            sequenceLast: lastSequenceId, // deprecated, to be removed
            lastSequenceId,
            asks,
            bids,
        });
        this.emit("l2update", l2Update, market);
    }

    /**
   {
      "code": "200000",
      "data": {
        "sequence": "1584724519811",
        "asks": [
          [
            "9631.9",
            "1.62256573"
          ],
          [
            "9632",
            "0.00000001"
          ]
        ],
        "bids": [
          [
            "9631.8",
            "0.19411805"
          ],
          [
            "9631.6",
            "0.00094623"
          ]
        ],
        "time": 1591469595966
      }
    }
   */
    protected async __requestLevel2Snapshot(market: Market) {
        try {
            const remote_id = market.id;
            const uri = `https://api.kucoin.com/api/v1/market/orderbook/level2_100?symbol=${remote_id}`;
            const raw: any = await https.get(uri);

            const asks = raw.data.asks.map(p => new Level2Point(p[0], p[1]));
            const bids = raw.data.bids.map(p => new Level2Point(p[0], p[1]));
            const snapshot = new Level2Snapshot({
                exchange: "KuCoin",
                sequenceId: Number(raw.data.sequence),
                base: market.base,
                quote: market.quote,
                asks,
                bids,
            });
            this.emit("l2snapshot", snapshot, market);
        } catch (ex) {
            this.emit("error", ex);
            await wait(this.restThrottleMs);
            this.__requestLevel2Snapshot(market);
        }
    }

    /**
   RECEIVED - This message type is really for informational purposes and
   does not include a side or price. Similar to the done message below
   we will include a psuedo-point with zeroedp price and amount to
   maintain consistency with other implementations.
   {
      "data": {
        "symbol": "BTC-USDT",
        "sequence": "1594781753800",
        "orderId": "5f3aa0c724d57500070d36e7",
        "clientOid": "cef1156e5f928d0e046a67891cdb780d",
        "ts": "1597677767948119917"
      },
      "subject": "received",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
  */
    protected _processL3UpdateReceived(msg: any) {
        const { symbol, sequence, orderId, clientOid, ts } = msg.data;

        const market = this._level3UpdateSubs.get(symbol);
        if (!market) return;

        const point = new Level3Point(orderId, "0", "0", { type: msg.subject, clientOid, ts });

        const update = new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs: Math.trunc(Number(ts) / 1e6),
            sequenceId: Number(sequence),
            asks: [point],
            bids: [point],
        });
        this.emit("l3update", update, market);
    }

    /**
    OPEN
    {
      "data": {
        "symbol": "BTC-USDT",
        "sequence": "1594781800484",
        "side": "buy",
        "orderTime": "1597678002842139731",
        "size": "0.65898942",
        "orderId": "5f3aa1b2b6aeb200072bd6d8",
        "price": "12139.8",
        "ts": "1597678002842139731"
      },
      "subject": "open",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
   */
    protected _processL3UpdateOpen(msg: any) {
        const { symbol, sequence, side, orderTime, size, orderId, price, ts } = msg.data;

        const market = this._level3UpdateSubs.get(symbol);
        if (!market) return;

        const asks = [];
        const bids = [];

        const point = new Level3Point(orderId, price, size, { type: msg.subject, orderTime, ts });
        if (side === "buy") bids.push(point);
        else asks.push(point);

        const update = new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: Number(sequence),
            timestampMs: Math.trunc(Number(ts) / 1e6),
            asks,
            bids,
        });
        this.emit("l3update", update, market);
    }

    /**
    DONE - because done does not include price,size, or side of book,
    we will create a zeroed point on both sides of the book. This keeps
    consistency with other order books that always have a point.

    {
      "data": {
        "symbol": "BTC-USDT",
        "reason": "canceled",
        "sequence": "1594781816444",
        "orderId": "5f3aa1f3b640150007baf5d6",
        "ts": "1597678072795057282"
      },
      "subject": "done",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
   */
    protected _processL3UpdateDone(msg: any) {
        const { symbol, sequence, orderId, reason, ts } = msg.data;

        const market = this._level3UpdateSubs.get(symbol);
        if (!market) return;

        const point = new Level3Point(orderId, "0", "0", { type: msg.subject, reason, ts });

        const update = new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: Number(sequence),
            timestampMs: Math.trunc(Number(ts) / 1e6),
            asks: [point],
            bids: [point],
        });
        this.emit("l3update", update, market);
    }

    /**
   MATCH - for the sake of the update, we will follow with the
   information that is updated in the orderbook, that is the maker. In
   this case, the remainSize is the value that should be adjusted
   for the maker's order.
   {
      "data": {
        "symbol": "BTC-USDT",
        "sequence": "1594781824886",
        "side": "sell",
        "size": "0.04541835",
        "price": "12161.1",
        "takerOrderId": "5f3aa220be5dd1000815506e",
        "makerOrderId": "5f3aa21db6aeb200072ce502",
        "tradeId": "5f3aa22078577835017d3de2",
        "remainSize": "1.44964657",
        "ts": "1597678112828040864"
      },
      "subject": "match",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
   */
    protected _processL3UpdateMatch(msg: any) {
        const {
            symbol,
            sequence,
            side,
            price,
            size,
            remainSize,
            takerOrderId,
            makerOrderId,
            tradeId,
            ts,
        } = msg.data;

        const market = this._level3UpdateSubs.get(symbol);
        if (!market) return;

        const asks = [];
        const bids = [];

        const point = new Level3Point(makerOrderId, "0", remainSize, {
            type: msg.subject,
            remainSize,
            takerOrderId,
            makerOrderId,
            tradeId,
            tradePrice: price,
            tradeSize: size,
            ts,
        });

        // The update is from the perspective of the maker. The side is side
        // of the taker, so we need to reverse it. That is a buy should
        // put the update on the ask side and a sell should put the update
        // on the bid side.
        if (side === "buy") asks.push(point);
        else bids.push(point);

        const update = new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: Number(sequence),
            timestampMs: Math.trunc(Number(ts) / 1e6),
            asks,
            bids,
        });

        this.emit("l3update", update, market);
    }

    /**
   CHANGE - because change does not include the side, we again duplicate
   points in the asks and bids. The price is also not inclued and is
   zeroed to maintain consistency with the remainder of the library
   {
      "data": {
        "symbol": "BTC-USDT",
        "sequence": "1594781878279",
        "size": "0.0087306",
        "orderId": "5f3aa2d2d5f3da0007802966",
        "ts": "1597678290249785626"
      },
      "subject": "update",
      "topic": "/spotMarket/level3:BTC-USDT",
      "type": "message"
    }
   */
    protected _processL3UpdateUpdate(msg: any) {
        const { symbol, sequence, orderId, size, ts } = msg.data;
        const market = this._level3UpdateSubs.get(symbol);
        if (!market) return;
        const point = new Level3Point(orderId, "0", size, { type: msg.subject, ts });
        const update = new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: Number(sequence),
            timestampMs: Math.trunc(Number(ts) / 1e6),
            asks: [point],
            bids: [point],
        });
        this.emit("l3update", update, market);
    }

    protected async __requestLevel3Snapshot(market: Market) {
        try {
            const remote_id = market.id;
            const uri = `https://api.kucoin.com/api/v1/market/orderbook/level3?symbol=${remote_id}`;
            const raw: any = await https.get(uri);

            const timestampMs = raw.data.time;
            const sequenceId = Number(raw.data.sequence);

            const asks = raw.data.asks.map(
                p =>
                    new Level3Point(p[0], p[1], p[2], {
                        orderTime: p[3],
                        timestampMs: Math.trunc(Number(p[3]) / 1e6),
                    }),
            );
            const bids = raw.data.bids.map(
                p =>
                    new Level3Point(p[0], p[1], p[2], {
                        orderTime: p[3],
                        timestampMs: Math.trunc(Number(p[3]) / 1e6),
                    }),
            );
            const snapshot = new Level3Snapshot({
                exchange: this.name,
                base: market.base,
                quote: market.quote,
                sequenceId,
                timestampMs,
                asks,
                bids,
            });
            this.emit("l3snapshot", snapshot, market);
        } catch (ex) {
            this.emit("error", ex);
            await wait(this.restThrottleMs);
            this.__requestLevel3Snapshot(market);
        }
    }
}

function candlePeriod(period) {
    switch (period) {
        case CandlePeriod._1m:
            return "1min";
        case CandlePeriod._3m:
            return "3min";
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
        case CandlePeriod._8h:
            return "8hour";
        case CandlePeriod._12h:
            return "12hour";
        case CandlePeriod._1d:
            return "1day";
        case CandlePeriod._1w:
            return "1week";
    }
}
