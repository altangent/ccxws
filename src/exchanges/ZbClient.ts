/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export class ZbClient extends BasicClient {
    public remoteIdMap: Map<string, string>;

    constructor({ wssPath = "wss://api.zb.work/websocket", watcherMs }: ClientOptions = {}) {
        super(wssPath, "ZB", undefined, watcherMs);
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasLevel2Snapshots = true;
        this.remoteIdMap = new Map();
    }

    protected _sendSubTicker(remote_id: string) {
        const wss_remote_id = remote_id.replace(/_/, "");
        this.remoteIdMap.set(wss_remote_id, remote_id);
        this._wss.send(
            JSON.stringify({
                event: "addChannel",
                channel: `${wss_remote_id}_ticker`,
            }),
        );
    }

    protected _sendUnsubTicker(remote_id: string) {
        const wss_remote_id = remote_id.replace(/_/, "");
        this.remoteIdMap.set(wss_remote_id, remote_id);
        this._wss.send(
            JSON.stringify({
                event: "removeChannel",
                channel: `${wss_remote_id}_ticker`,
            }),
        );
    }

    protected _sendSubTrades(remote_id: string) {
        const wss_remote_id = remote_id.replace(/_/, "");
        this.remoteIdMap.set(wss_remote_id, remote_id);
        this._wss.send(
            JSON.stringify({
                event: "addChannel",
                channel: `${wss_remote_id}_trades`,
            }),
        );
    }

    protected _sendUnsubTrades(remote_id: string) {
        const wss_remote_id = remote_id.replace(/_/, "");
        this.remoteIdMap.set(wss_remote_id, remote_id);
        this._wss.send(
            JSON.stringify({
                event: "removeChannel",
                channel: `${wss_remote_id}_trades`,
            }),
        );
    }

    protected _sendSubLevel2Snapshots(remote_id: string) {
        const wss_remote_id = remote_id.replace(/_/, "");
        this.remoteIdMap.set(wss_remote_id, remote_id);
        this._wss.send(
            JSON.stringify({
                event: "addChannel",
                channel: `${wss_remote_id}_depth`,
            }),
        );
    }

    protected _sendUnsubLevel2Snapshots(remote_id: string) {
        const wss_remote_id = remote_id.replace(/_/, "");
        this.remoteIdMap.set(wss_remote_id, remote_id);
        this._wss.send(
            JSON.stringify({
                event: "removeChannel",
                channel: `${wss_remote_id}_depth`,
            }),
        );
    }

    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendSubLevel2Updates = NotImplementedFn;
    protected _sendUnsubLevel2Updates = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    protected _onMessage(raw: any) {
        const msg = JSON.parse(raw);
        const [wssRemoteId, type] = msg.channel.split("_");
        const remoteId = this.remoteIdMap.get(wssRemoteId);

        // prevent errors from crashing the party
        if (msg.success === false) {
            return;
        }

        // tickers
        if (type === "ticker") {
            const market = this._tickerSubs.get(remoteId);
            if (!market) return;

            const ticker = this._constructTicker(msg, market);
            this.emit("ticker", ticker, market);
            return;
        }

        // trades
        if (type === "trades") {
            for (const datum of msg.data) {
                const market = this._tradeSubs.get(remoteId);
                if (!market) return;

                const trade = this._constructTradesFromMessage(datum, market);
                this.emit("trade", trade, market);
            }
            return;
        }

        // level2snapshots
        if (type === "depth") {
            const market = this._level2SnapshotSubs.get(remoteId);
            if (!market) return;

            const snapshot = this._constructLevel2Snapshot(msg, market);
            this.emit("l2snapshot", snapshot, market);
            return;
        }
    }

    protected _constructTicker(data, market) {
        const timestamp = parseInt(data.date);
        const ticker = data.ticker;
        return new Ticker({
            exchange: "ZB",
            base: market.base,
            quote: market.quote,
            timestamp,
            last: ticker.last,
            open: undefined,
            high: ticker.high,
            low: ticker.low,
            volume: ticker.vol,
            quoteVolume: undefined,
            change: undefined,
            changePercent: undefined,
            bid: ticker.buy,
            ask: ticker.sell,
        });
    }

    protected _constructTradesFromMessage(datum, market) {
        const { date, price, amount, tid, type } = datum;
        return new Trade({
            exchange: "ZB",
            base: market.base,
            quote: market.quote,
            tradeId: tid.toString(),
            side: type,
            unix: parseInt(date) * 1000,
            price,
            amount,
        });
    }

    protected _constructLevel2Snapshot(msg, market) {
        let { timestamp, asks, bids } = msg;
        asks = asks.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8))).reverse();
        bids = bids.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(8)));
        return new Level2Snapshot({
            exchange: "ZB",
            base: market.base,
            quote: market.quote,
            timestampMs: timestamp * 1000,
            asks,
            bids,
        });
    }
}
