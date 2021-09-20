/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Decimal from "decimal.js";
import moment = require("moment");
import { BasicClient } from "../BasicClient";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Level2Update } from "../Level2Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export class FtxBaseClient extends BasicClient {
    constructor({ name, wssPath, watcherMs }) {
        super(wssPath, name, undefined, watcherMs);
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasLevel2Updates = true;
    }

    protected _sendSubTicker(market) {
        this._wss.send(
            JSON.stringify({
                op: "subscribe",
                channel: "ticker",
                market,
            }),
        );
    }

    protected _sendUnsubTicker(market) {
        this._wss.send(
            JSON.stringify({
                op: "unsubscribe",
                channel: "ticker",
                market,
            }),
        );
    }

    protected _sendSubTrades(market) {
        this._wss.send(
            JSON.stringify({
                op: "subscribe",
                channel: "trades",
                market,
            }),
        );
    }

    protected _sendUnsubTrades(market) {
        this._wss.send(
            JSON.stringify({
                op: "unsubscribe",
                channel: "trades",
                market,
            }),
        );
    }

    protected _sendSubLevel2Updates(market) {
        this._wss.send(
            JSON.stringify({
                op: "subscribe",
                channel: "orderbook",
                market,
            }),
        );
    }

    protected _sendUnsubLevel2Updates(market) {
        this._wss.send(
            JSON.stringify({
                op: "subscribe",
                channel: "orderbook",
                market,
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
        const { type, channel, market: symbol, data } = JSON.parse(raw);
        if (!data || !type || !channel || !symbol) {
            return;
        }

        switch (channel) {
            case "ticker":
                this._tickerMessageHandler(data, symbol);
                break;
            case "trades":
                this._tradesMessageHandler(data, symbol);
                break;
            case "orderbook":
                this._orderbookMessageHandler(data, symbol, type);
                break;
        }
    }

    protected _tickerMessageHandler(data, symbol) {
        const market = this._tickerSubs.get(symbol);
        if (!market || !market.base || !market.quote) {
            return;
        }

        const timestamp = this._timeToTimestampMs(data.time);
        const { last, bid, ask, bidSize: bidVolume, askSize: askVolume } = data;
        const ticker = new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp,
            last: last !== undefined && last !== null ? last.toFixed(8) : undefined,
            bid: bid !== undefined && bid !== null ? bid.toFixed(8) : undefined,
            ask: ask !== undefined && ask !== null ? ask.toFixed(8) : undefined,
            bidVolume:
                bidVolume !== undefined && bidVolume !== null ? bidVolume.toFixed(8) : undefined,
            askVolume:
                askVolume !== undefined && askVolume !== null ? askVolume.toFixed(8) : undefined,
        });

        this.emit("ticker", ticker, market);
    }

    protected _tradesMessageHandler(data, symbol) {
        const market = this._tradeSubs.get(symbol);
        if (!market || !market.base || !market.quote) {
            return;
        }

        for (const entry of data) {
            const { id, price, size, side, time, liquidation } = entry;
            const unix = moment.utc(time).valueOf();

            const trade = new Trade({
                exchange: this.name,
                base: market.base,
                quote: market.quote,
                tradeId: id.toString(),
                side,
                unix,
                price: price.toFixed(8),
                amount: size.toFixed(8),
                liquidation,
            });

            this.emit("trade", trade, market);
        }
    }

    protected _orderbookMessageHandler(data, symbol, type) {
        const market = this._level2UpdateSubs.get(symbol);
        if (!market || !market.base || !market.quote || (!data.asks.length && !data.bids.length)) {
            return;
        }

        switch (type) {
            case "partial":
                this._orderbookSnapshotEvent(data, market);
                break;
            case "update":
                this._orderbookUpdateEvent(data, market);
                break;
        }
    }

    protected _orderbookUpdateEvent(data, market) {
        const content = this._orderbookEventContent(data, market);
        const eventData = new Level2Update(content);
        this.emit("l2update", eventData, market);
    }

    protected _orderbookSnapshotEvent(data, market) {
        const content = this._orderbookEventContent(data, market);
        const eventData = new Level2Snapshot(content);
        this.emit("l2snapshot", eventData, market);
    }

    protected _orderbookEventContent(data, market) {
        const { time, asks, bids, checksum } = data;
        const level2PointAsks = asks.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
        const level2PointBids = bids.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
        const timestampMs = this._timeToTimestampMs(time);

        return {
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs,
            asks: level2PointAsks,
            bids: level2PointBids,
            checksum,
        };
    }

    protected _timeToTimestampMs(time) {
        return new Decimal(time).mul(1000).toDecimalPlaces(0).toNumber();
    }
}
