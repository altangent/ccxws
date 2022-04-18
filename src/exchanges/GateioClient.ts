/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-implied-eval */
import moment from "moment";
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Level2Update } from "../Level2Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

/**
 * Gate.io now supports subscribing to multiple markets from a single socket connection.
 * These requests will be debounced so that multiple subscriptions will trigger a
 * single call to subscribe.
 *
 * Additionally, depending on the REST method used, the market_id's will be lower
 * or uppercase. Websockets require market_id in uppercase, however the client
 * can handle either.
 */
export class GateioClient extends BasicClient {
    public debounceWait: number;
    protected _debounceHandles: Map<any, any>;
    protected _pingInterval: NodeJS.Timeout;

    constructor({ wssPath = "wss://ws.gate.io/v3", watcherMs = 900 * 1000 }: ClientOptions = {}) {
        super(wssPath, "Gateio", undefined, watcherMs);
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasLevel2Snapshots = false;
        this.hasLevel2Updates = true;
        this.hasLevel3Updates = false;
        this.debounceWait = 100;
        this._debounceHandles = new Map();
    }

    protected _debounce(type, fn) {
        clearTimeout(this._debounceHandles.get(type));
        this._debounceHandles.set(type, setTimeout(fn, this.debounceWait));
    }

    protected _beforeConnect() {
        this._wss.on("connected", this._startPing.bind(this));
        this._wss.on("disconnected", this._stopPing.bind(this));
        this._wss.on("closed", this._stopPing.bind(this));
    }

    protected _startPing() {
        clearInterval(this._pingInterval);
        this._pingInterval = setInterval(this._sendPing.bind(this), 30000);
    }

    protected _stopPing() {
        clearInterval(this._pingInterval);
    }

    protected _sendPing() {
        if (this._wss) {
            this._wss.send(
                JSON.stringify({
                    method: "server.ping",
                }),
            );
        }
    }

    protected _sendSubTicker() {
        this._debounce("sub-ticker", () => {
            const markets = Array.from(this._tickerSubs.keys()).map(m => m.toUpperCase()); // must be uppercase
            this._wss.send(
                JSON.stringify({
                    method: "ticker.subscribe",
                    params: markets,
                    id: 1,
                }),
            );
        });
    }

    protected _sendUnsubTicker() {
        this._wss.send(
            JSON.stringify({
                method: "ticker.unsubscribe",
            }),
        );
    }

    protected _sendSubTrades() {
        this._debounce("sub-trades", () => {
            const markets = Array.from(this._tradeSubs.keys()).map(m => m.toUpperCase()); // must be uppercase
            this._wss.send(
                JSON.stringify({
                    method: "trades.subscribe",
                    params: markets,
                    id: 1,
                }),
            );
        });
    }

    protected _sendUnsubTrades() {
        this._wss.send(
            JSON.stringify({
                method: "trades.unsubscribe",
            }),
        );
    }

    protected _sendSubLevel2Updates() {
        this._debounce("sub-l2updates", () => {
            const markets = Array.from(this._level2UpdateSubs.keys()).map(m => m.toUpperCase()); // must be uppercase
            this._wss.send(
                JSON.stringify({
                    method: "depth.subscribe",
                    params: markets.map(m => [m, 30, "0"]),
                    id: 1,
                }),
            );
        });
    }

    protected _sendUnsubLevel2Updates() {
        this._wss.send(
            JSON.stringify({
                method: "depth.unsubscribe",
            }),
        );
    }

    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    protected _onMessage(raw) {
        const msg = JSON.parse(raw);
        const { method, params } = msg;

        // if params is not defined, then this is a response to an event that we don't care about (like the initial connection event)
        if (!params) return;

        if (method === "ticker.update") {
            const marketId = params[0];
            const market =
                this._tickerSubs.get(marketId.toUpperCase()) ||
                this._tickerSubs.get(marketId.toLowerCase());
            if (!market) return;

            const ticker = this._constructTicker(params[1], market); //params[0][marketId] -> params[1]
            this.emit("ticker", ticker, market);
            return;
        }

        if (method === "trades.update") {
            const marketId = params[0];
            const market =
                this._tradeSubs.get(marketId.toUpperCase()) ||
                this._tradeSubs.get(marketId.toLowerCase());
            if (!market) return;

            for (const t of params[1].reverse()) {
                const trade = this._constructTrade(t, market);
                this.emit("trade", trade, market);
            }
            return;
        }

        if (method === "depth.update") {
            const marketId = params[2];
            const market =
                this._level2UpdateSubs.get(marketId.toUpperCase()) ||
                this._level2UpdateSubs.get(marketId.toLowerCase());
            if (!market) return;

            const isLevel2Snapshot = params[0];
            if (isLevel2Snapshot) {
                const l2snapshot = this._constructLevel2Snapshot(params[1], market);
                this.emit("l2snapshot", l2snapshot, market);
            } else {
                const l2update = this._constructLevel2Update(params[1], market);
                this.emit("l2update", l2update, market);
            }
            return;
        }
    }

    protected _constructTicker(rawTick, market) {
        const change = parseFloat(rawTick.last) - parseFloat(rawTick.open);
        const changePercent =
            ((parseFloat(rawTick.last) - parseFloat(rawTick.open)) / parseFloat(rawTick.open)) *
            100;

        return new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp: Date.now(),
            last: rawTick.last,
            open: rawTick.open,
            high: rawTick.high,
            low: rawTick.low,
            volume: rawTick.baseVolume,
            quoteVolume: rawTick.quoteVolume,
            change: change.toFixed(8),
            changePercent: changePercent.toFixed(8),
        });
    }

    protected _constructTrade(rawTrade, market) {
        const { id, time, type, price, amount } = rawTrade;

        const unix = moment.utc(time * 1000).valueOf();

        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: id.toFixed(),
            unix,
            side: type,
            price,
            amount,
        });
    }

    protected _constructLevel2Snapshot(rawUpdate, market) {
        let { bids, asks } = rawUpdate,
            structuredBids = bids ? bids.map(([price, size]) => new Level2Point(price, size)) : [],
            structuredAsks = asks ? asks.map(([price, size]) => new Level2Point(price, size)) : [];

        return new Level2Snapshot({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            bids: structuredBids,
            asks: structuredAsks,
        });
    }

    protected _constructLevel2Update(rawUpdate, market) {
        let { bids, asks } = rawUpdate,
            structuredBids = bids ? bids.map(([price, size]) => new Level2Point(price, size)) : [],
            structuredAsks = asks ? asks.map(([price, size]) => new Level2Point(price, size)) : [];

        return new Level2Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            bids: structuredBids,
            asks: structuredAsks,
        });
    }
}
