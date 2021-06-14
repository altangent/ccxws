/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import moment from "moment";
import { BasicClient } from "../BasicClient";
import { Candle } from "../Candle";
import { CandlePeriod } from "../CandlePeriod";
import { ClientOptions } from "../ClientOptions";
import { CancelableFn } from "../flowcontrol/Fn";
import { throttle } from "../flowcontrol/Throttle";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Level2Update } from "../Level2Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export class HitBtcClient extends BasicClient {
    public candlePeriod: CandlePeriod;

    protected _id: number;
    protected _send: CancelableFn;

    constructor({
        wssPath = "wss://api.hitbtc.com/api/2/ws",
        throttleMs = 25,
        watcherMs,
    }: ClientOptions = {}) {
        super(wssPath, "HitBTC", undefined, watcherMs);
        this._id = 0;

        this.hasTickers = true;
        this.hasTrades = true;
        this.hasCandles = true;
        this.hasLevel2Updates = true;
        this.candlePeriod = CandlePeriod._1m;
        this._send = throttle(this.__send.bind(this), throttleMs);
    }

    protected _beforeClose() {
        this._send.cancel();
    }

    protected __send(msg) {
        this._wss.send(msg);
    }

    protected _sendSubTicker(remote_id: string) {
        this._send(
            JSON.stringify({
                method: "subscribeTicker",
                params: {
                    symbol: remote_id,
                },
                id: ++this._id,
            }),
        );
    }

    protected _sendUnsubTicker(remote_id: string) {
        this._send(
            JSON.stringify({
                method: "unsubscribeTicker",
                params: {
                    symbol: remote_id,
                },
            }),
        );
    }

    protected _sendSubTrades(remote_id: string) {
        this._send(
            JSON.stringify({
                method: "subscribeTrades",
                params: {
                    symbol: remote_id,
                },
                id: ++this._id,
            }),
        );
    }

    protected _sendUnsubTrades(remote_id: string) {
        this._send(
            JSON.stringify({
                method: "unsubscribeTrades",
                params: {
                    symbol: remote_id,
                },
            }),
        );
    }

    protected _sendSubCandles(remote_id: string) {
        this._send(
            JSON.stringify({
                method: "subscribeCandles",
                params: {
                    symbol: remote_id,
                    period: candlePeriod(this.candlePeriod),
                },
                id: ++this._id,
            }),
        );
    }

    protected _sendUnsubCandles(remote_id: string) {
        this._send(
            JSON.stringify({
                method: "unsubscribeCandles",
                params: {
                    symbol: remote_id,
                    period: candlePeriod(this.candlePeriod),
                },
            }),
        );
    }

    protected _sendSubLevel2Updates(remote_id: string) {
        this._send(
            JSON.stringify({
                method: "subscribeOrderbook",
                params: {
                    symbol: remote_id,
                },
                id: ++this._id,
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id: string) {
        this._send(
            JSON.stringify({
                method: "unsubscribeOrderbook",
                params: {
                    symbol: remote_id,
                },
            }),
        );
    }

    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    protected _onMessage(raw: string) {
        const msg = JSON.parse(raw);

        // The payload for a subscribe confirm will include the id that
        // was attached in the JSON-RPC call creation.  For example:
        // { jsonrpc: '2.0', result: true, id: 7 }
        if (msg.result === true && msg.id) {
            // console.log(msg);
            // return;
        }

        // For unsubscribe calls, we are not including an id
        // so we can ignore messages that do not can an id value:
        // { jsonrpc: '2.0', result: true, id: null }
        if (msg.result !== undefined && msg.id) {
            return;
        }

        const remote_id = msg.params && msg.params.symbol;

        if (msg.method === "ticker") {
            const market = this._tickerSubs.get(remote_id);
            if (!market) return;

            const ticker = this._constructTicker(msg.params, market);
            this.emit("ticker", ticker, market);
        }

        if (msg.method === "updateTrades") {
            const market = this._tradeSubs.get(remote_id);
            if (!market) return;

            for (const datum of msg.params.data) {
                const trade = this._constructTradesFromMessage(datum, market);
                this.emit("trade", trade, market);
            }
            return;
        }

        if (msg.method === "updateCandles") {
            const market = this._candleSubs.get(remote_id);
            if (!market) return;

            for (const datum of msg.params.data) {
                const candle = this._constructCandle(datum);
                this.emit("candle", candle, market);
            }
        }

        if (msg.method === "snapshotOrderbook") {
            const market = this._level2UpdateSubs.get(remote_id); // coming from l2update sub
            if (!market) return;

            const result = this._constructLevel2Snapshot(msg.params, market);
            this.emit("l2snapshot", result, market);
            return;
        }

        if (msg.method === "updateOrderbook") {
            const market = this._level2UpdateSubs.get(remote_id);
            if (!market) return;

            const result = this._constructLevel2Update(msg.params, market);
            this.emit("l2update", result, market);
            return;
        }
    }

    protected _constructTicker(param, market) {
        const { ask, bid, last, open, low, high, volume, volumeQuote, timestamp } = param;
        const change = (parseFloat(last) - parseFloat(open)).toFixed(8);
        const changePercent = (
            ((parseFloat(last) - parseFloat(open)) / parseFloat(open)) *
            100
        ).toFixed(8);
        return new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp: moment.utc(timestamp).valueOf(),
            last,
            open,
            high,
            low,
            volume,
            quoteVolume: volumeQuote,
            ask,
            bid,
            change,
            changePercent,
        });
    }

    protected _constructTradesFromMessage(datum, market) {
        const { id, price, quantity, side, timestamp } = datum;

        const unix = moment(timestamp).valueOf();

        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: id.toFixed(),
            side,
            unix,
            price,
            amount: quantity,
        });
    }

    protected _constructCandle(datum) {
        const unix = moment(datum.timestamp).valueOf();
        return new Candle(unix, datum.open, datum.max, datum.min, datum.close, datum.volume);
    }

    protected _constructLevel2Snapshot(data, market) {
        const { ask, bid, sequence } = data;
        const asks = ask.map(p => new Level2Point(p.price, p.size));
        const bids = bid.map(p => new Level2Point(p.price, p.size));
        return new Level2Snapshot({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: sequence,
            asks,
            bids,
        });
    }

    protected _constructLevel2Update(data, market) {
        const { ask, bid, sequence } = data;
        const asks = ask.map(p => new Level2Point(p.price, p.size, p.count));
        const bids = bid.map(p => new Level2Point(p.price, p.size, p.count));
        return new Level2Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: sequence,
            asks,
            bids,
        });
    }
}

function candlePeriod(period: CandlePeriod): string {
    switch (period) {
        case CandlePeriod._1m:
            return "M1";
        case CandlePeriod._3m:
            return "M3";
        case CandlePeriod._5m:
            return "M5";
        case CandlePeriod._15m:
            return "M15";
        case CandlePeriod._30m:
            return "M30";
        case CandlePeriod._1h:
            return "H1";
        case CandlePeriod._4h:
            return "H4";
        case CandlePeriod._1d:
            return "D1";
        case CandlePeriod._1w:
            return "D7";
        case CandlePeriod._1M:
            return "1M";
    }
}
