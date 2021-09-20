/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import * as crypto from "crypto";
import { BasicClient } from "../BasicClient";
import { BasicMultiClient } from "../BasicMultiClient";
import { Candle } from "../Candle";
import { CandlePeriod } from "../CandlePeriod";
import { IClient } from "../IClient";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Market } from "../Market";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";
import { Watcher } from "../Watcher";

function createSignature(timestamp: number, apiKey: string, apiSecret: string) {
    const hmac = crypto.createHmac("sha256", apiSecret);
    hmac.update(timestamp.toString() + apiKey);
    return hmac.digest("hex");
}

function createAuthToken(apiKey: string, apiSecret: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    return {
        key: apiKey,
        signature: createSignature(timestamp, apiKey, apiSecret),
        timestamp,
    };
}

const multiplier = {
    ADA: 1e6,
    ATOM: 1e6,
    BAT: 1e6,
    GAS: 1e8,
    NEO: 1e6,
    ONT: 1e6,
    ONG: 1e6,
    MATIC: 1e6,
    LINK: 1e6,
    XTZ: 1e6,
    BCH: 1e8,
    BTC: 1e8,
    BTG: 1e8,
    BTT: 1e6,
    DASH: 1e8,
    ETH: 1e6,
    GUSD: 1e2,
    LTC: 1e8,
    MHC: 1e6,
    OMG: 1e6,
    TRX: 1e6,
    XLM: 1e7,
    XRP: 1e6,
    ZEC: 1e8,
};

function formatAmount(amount: string, symbol: string) {
    return (parseInt(amount) / multiplier[symbol]).toFixed(8);
}

export type CexClientOptions = {
    apiKey: string;
    apiSecret: string;
};

export class CexClient extends BasicMultiClient {
    public name: string;
    public options: CexClientOptions;
    public candlePeriod: CandlePeriod;

    /**
     * Creates a new CEX.io client using the supplied credentials
     */
    constructor(options: CexClientOptions) {
        super();
        this._clients = new Map();

        this.name = "CEX_MULTI";
        this.options = options;
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasCandles = true;
        this.hasLevel2Snapshots = true;
        this.candlePeriod = CandlePeriod._1m;
    }

    protected _createBasicClient(clientArgs: { market: Market }): IClient {
        return new SingleCexClient({
            ...this.options,
            market: clientArgs.market,
            parent: this,
        });
    }
}

export class SingleCexClient extends BasicClient {
    public auth: { apiKey: string; apiSecret: string };
    public market: Market;
    public hasTickers: boolean;
    public hasTrades: boolean;
    public hasCandles: boolean;
    public hasLevel2Snapshots: boolean;
    public authorized: boolean;
    public parent: CexClient;

    protected _sendSubLevel2Updates = NotImplementedFn;
    protected _sendUnsubLevel2Updates = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    constructor({
        wssPath = "wss://ws.cex.io/ws",
        watcherMs = 900 * 1000,
        apiKey,
        apiSecret,
        market,
        parent,
    }: {
        wssPath?: string;
        watcherMs?: number;
        apiKey: string;
        apiSecret: string;
        market: Market;
        parent: CexClient;
    }) {
        super(wssPath, "CEX", undefined, watcherMs);
        this._watcher = new Watcher(this, watcherMs);
        this.auth = { apiKey, apiSecret };
        this.market = market;
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasCandles = true;
        this.hasLevel2Snapshots = true;
        this.authorized = false;
        this.parent = parent;
    }

    public get candlePeriod(): CandlePeriod {
        return this.parent.candlePeriod;
    }

    /**
     * This method is fired anytime the socket is opened, whether
     * the first time, or any subsequent reconnects.
     * Since this is an authenticated feed, we first send an authenticate
     * request, and the normal subscriptions happen after authentication has
     * completed in the _onAuthorized method.
     */
    protected _onConnected() {
        this._sendAuthorizeRequest();
    }

    /**
     * Trigger after an authorization packet has been successfully received.
     * This code triggers the usual _onConnected code afterwards.
     */
    protected _onAuthorized() {
        this.authorized = true;
        this.emit("authorized");
        super._onConnected();
    }

    protected _sendAuthorizeRequest() {
        this._wss.send(
            JSON.stringify({
                e: "auth",
                auth: createAuthToken(this.auth.apiKey, this.auth.apiSecret),
            }),
        );
    }

    protected _sendPong() {
        if (this._wss) {
            this._wss.send(JSON.stringify({ e: "pong" }));
        }
    }

    protected _sendSubTicker() {
        if (!this.authorized) return;
        this._wss.send(
            JSON.stringify({
                e: "subscribe",
                rooms: ["tickers"],
            }),
        );
    }

    protected _sendUnsubTicker() {
        //
    }

    protected _sendSubTrades(remote_id: string) {
        if (!this.authorized) return;
        this._wss.send(
            JSON.stringify({
                e: "subscribe",
                rooms: [`pair-${remote_id.replace("/", "-")}`],
            }),
        );
    }

    protected _sendUnsubTrades() {
        //
    }

    protected _sendSubCandles(remote_id: string) {
        if (!this.authorized) return;
        this._wss.send(
            JSON.stringify({
                e: "init-ohlcv",
                i: candlePeriod(this.candlePeriod),
                rooms: [`pair-${remote_id.replace("/", "-")}`],
            }),
        );
    }

    protected _sendUnsubCandles() {
        //
    }

    protected _sendSubLevel2Snapshots(remote_id: string) {
        if (!this.authorized) return;
        this._wss.send(
            JSON.stringify({
                e: "subscribe",
                rooms: [`pair-${remote_id.replace("/", "-")}`],
            }),
        );
    }

    protected _sendUnsubLevel2Snapshots() {
        //
    }

    protected _onMessage(raw: any) {
        const message = JSON.parse(raw);
        const { e, data } = message;

        if (e === "ping") {
            this._sendPong();
            return;
        }

        if (e === "subscribe") {
            if (message.error) {
                throw new Error(`CEX error: ${JSON.stringify(message)}`);
            }
        }

        if (e === "auth") {
            if (data.ok === "ok") {
                this._onAuthorized();
            } else {
                throw new Error("Authentication error");
            }
            return;
        }

        if (e === "tick") {
            // {"e":"tick","data":{"symbol1":"BTC","symbol2":"USD","price":"4244.4","open24":"4248.4","volume":"935.58669239"}}
            const marketId = `${data.symbol1}/${data.symbol2}`;
            const market = this._tickerSubs.get(marketId);
            if (!market) return;

            const ticker = this._constructTicker(data, market);
            this.emit("ticker", ticker, market);
            return;
        }

        if (e === "md") {
            const marketId = data.pair.replace(":", "/");
            const market = this._level2SnapshotSubs.get(marketId);
            if (!market) return;

            const result = this._constructevel2Snapshot(data, market);
            this.emit("l2snapshot", result, market);
            return;
        }

        if (e === "history") {
            const marketId = this.market.id;
            const market = this._tradeSubs.get(marketId);
            if (!market) return;

            // sell/buy:timestamp_ms:amount:price:transaction_id
            for (const rawTrade of data.reverse()) {
                const tradeData = rawTrade.split(":");
                const trade = this._constructTrade(tradeData, market);
                this.emit("trade", trade, market);
            }
            return;
        }

        if (e === "history-update") {
            const marketId = this.market.id;
            const market = this._tradeSubs.get(marketId);
            if (this._tradeSubs.has(marketId)) {
                for (const rawTrade of data) {
                    const trade = this._constructTrade(rawTrade, market);
                    this.emit("trade", trade, market);
                }
                return;
            }
        }

        // ohlcv{period} - why the F*** are there three styles of candles???
        if (e === `ohlcv${candlePeriod(this.candlePeriod)}`) {
            const marketId = message.data.pair.replace(":", "/");
            const market = this._candleSubs.get(marketId);
            if (!market) return;

            const candle = this._constructCandle(message.data);
            this.emit("candle", candle, market);
            return;
        }
    }

    protected _constructTicker(data: any, market: Market) {
        // {"e":"tick","data":{"symbol1":"BTC","symbol2":"USD","price":"4244.4","open24":"4248.4","volume":"935.58669239"}}
        const { open24, price, volume } = data;
        const change = parseFloat(price) - parseFloat(open24);
        const changePercent =
            open24 !== 0
                ? ((parseFloat(price) - parseFloat(open24)) / parseFloat(open24)) * 100
                : 0;

        return new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp: Date.now(),
            last: price,
            open: open24,
            volume: volume,
            change: change.toFixed(8),
            changePercent: changePercent.toFixed(8),
        });
    }

    protected _constructevel2Snapshot(msg: any, market: Market) {
        const asks = msg.sell.map(
            p => new Level2Point(p[0].toFixed(8), formatAmount(p[1], market.base)),
        );
        const bids = msg.buy.map(
            p => new Level2Point(p[0].toFixed(8), formatAmount(p[1], market.base)),
        );

        return new Level2Snapshot({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: msg.id,
            asks,
            bids,
        });
    }

    protected _constructTrade(data: any, market: Market) {
        //["buy","1543967891439","4110282","3928.1","9437977"]
        //format: sell/buy, timestamp_ms, amount, price, transaction_id
        const [side, timestamp_ms, amount, price, tradeId] = data;

        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: tradeId,
            unix: parseInt(timestamp_ms),
            side: side,
            price: price,
            amount: formatAmount(amount, market.base),
            rawAmount: amount,
        });
    }

    /**
   {
      e: 'ohlcv1m',
      data: {
        pair: 'BTC:USD',
        time: '1597261140',
        o: '11566.8',
        h: '11566.8',
        l: '11566.8',
        c: '11566.8',
        v: 664142,
        d: 664142
      }
    }
   */
    protected _constructCandle(data) {
        const ms = Number(data.time) * 1000;
        return new Candle(ms, data.o, data.h, data.l, data.c, data.v.toFixed(8));
    }
}

function candlePeriod(period) {
    switch (period) {
        case CandlePeriod._1m:
            return "1m";
        case CandlePeriod._3m:
            return "3m";
        case CandlePeriod._5m:
            return "5m";
        case CandlePeriod._15m:
            return "15m";
        case CandlePeriod._30m:
            return "30m";
        case CandlePeriod._1h:
            return "1h";
        case CandlePeriod._2h:
            return "2h";
        case CandlePeriod._4h:
            return "4h";
        case CandlePeriod._6h:
            return "6h";
        case CandlePeriod._12h:
            return "12h";
        case CandlePeriod._1d:
            return "1d";
        case CandlePeriod._3d:
            return "3d";
        case CandlePeriod._1w:
            return "1w";
    }
}
