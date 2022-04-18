/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import moment = require("moment");
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Level2Update } from "../Level2Update";
import { Level3Point } from "../Level3Point";
import { Level3Update } from "../Level3Update";
import { Market } from "../Market";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export class CoinbaseProClient extends BasicClient {
    constructor({ wssPath = "wss://ws-feed.pro.coinbase.com", watcherMs }: ClientOptions = {}) {
        super(wssPath, "CoinbasePro", undefined, watcherMs);
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasLevel2Updates = true;
        this.hasLevel3Updates = true;
    }

    protected _sendSubTicker(remote_id) {
        this._wss.send(
            JSON.stringify({
                type: "subscribe",
                product_ids: [remote_id],
                channels: ["ticker"],
            }),
        );
    }

    protected _sendUnsubTicker(remote_id) {
        this._wss.send(
            JSON.stringify({
                type: "unsubscribe",
                product_ids: [remote_id],
                channels: ["ticker"],
            }),
        );
    }

    protected _sendSubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                type: "subscribe",
                product_ids: [remote_id],
                channels: ["matches"],
            }),
        );
    }

    protected _sendUnsubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                type: "unsubscribe",
                product_ids: [remote_id],
                channels: ["matches"],
            }),
        );
    }

    protected _sendSubLevel2Updates(remote_id) {
        this._wss.send(
            JSON.stringify({
                type: "subscribe",
                product_ids: [remote_id],
                channels: ["level2"],
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id) {
        this._wss.send(
            JSON.stringify({
                type: "unsubscribe",
                product_ids: [remote_id],
                channels: ["level2"],
            }),
        );
    }

    protected _sendSubLevel3Updates(remote_id) {
        this._wss.send(
            JSON.stringify({
                type: "subscribe",
                product_ids: [remote_id],
                channels: ["full"],
            }),
        );
    }

    protected _sendUnsubLevel3Updates(remote_id) {
        this._wss.send(
            JSON.stringify({
                type: "unsubscribe",
                product_ids: [remote_id],
                channels: ["full"],
            }),
        );
    }

    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;

    protected _onMessage(raw) {
        const msg = JSON.parse(raw);

        const { type, product_id } = msg;

        if (type === "ticker" && this._tickerSubs.has(product_id)) {
            const market = this._tickerSubs.get(product_id);
            const ticker = this._constructTicker(msg, market);
            this.emit("ticker", ticker, market);
        }

        if (type === "match" && this._tradeSubs.has(product_id)) {
            const market = this._tradeSubs.get(product_id);
            const trade = this._constructTrade(msg, market);
            this.emit("trade", trade, market);
        }

        if (type === "snapshot" && this._level2UpdateSubs.has(product_id)) {
            const market = this._level2UpdateSubs.get(product_id);
            const snapshot = this._constructLevel2Snapshot(msg, market);
            this.emit("l2snapshot", snapshot, market);
        }

        if (type === "l2update" && this._level2UpdateSubs.has(product_id)) {
            const market = this._level2UpdateSubs.get(product_id);
            const update = this._constructLevel2Update(msg, market);
            this.emit("l2update", update, market);
        }

        if (
            (type === "received" ||
                type === "open" ||
                type === "done" ||
                type === "match" ||
                type === "change") &&
            this._level3UpdateSubs.has(product_id)
        ) {
            const market = this._level3UpdateSubs.get(product_id);
            const update = this._constructLevel3Update(msg, market);
            this.emit("l3update", update, market);
            return;
        }
    }

    protected _constructTicker(msg, market: Market) {
        const { price, volume_24h, open_24h, low_24h, high_24h, best_bid, best_ask, time } = msg;
        const change = parseFloat(price) - parseFloat(open_24h);
        const changePercent =
            ((parseFloat(price) - parseFloat(open_24h)) / parseFloat(open_24h)) * 100;
        return new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp: moment.utc(time).valueOf(),
            last: price,
            open: open_24h,
            high: high_24h,
            low: low_24h,
            volume: volume_24h,
            change: change.toFixed(8),
            changePercent: changePercent.toFixed(8),
            bid: best_bid,
            ask: best_ask,
        });
    }

    protected _constructTrade(msg, market: Market) {
        let { trade_id, time, size, price, side, maker_order_id, taker_order_id } = msg;

        const unix = moment.utc(time).valueOf();

        maker_order_id = maker_order_id.replace(/-/g, "");
        taker_order_id = taker_order_id.replace(/-/g, "");

        const buyOrderId = side === "buy" ? maker_order_id : taker_order_id;
        const sellOrderId = side === "sell" ? maker_order_id : taker_order_id;

        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: trade_id.toFixed(),
            unix,
            side,
            price,
            amount: size,
            buyOrderId,
            sellOrderId,
        });
    }

    protected _constructLevel2Snapshot(msg, market: Market) {
        let { bids, asks } = msg;
        bids = bids.map(([price, size]) => new Level2Point(price, size));
        asks = asks.map(([price, size]) => new Level2Point(price, size));

        return new Level2Snapshot({
            exchange: "CoinbasePro",
            base: market.base,
            quote: market.quote,
            bids,
            asks,
        });
    }

    protected _constructLevel2Update(msg, market: Market) {
        const { changes, time } = msg;
        const timestampMs = new Date(time).getTime();
        const asks = [];
        const bids = [];
        for (const [side, price, size] of changes) {
            const point = new Level2Point(price, size);
            if (side === "buy") bids.push(point);
            else asks.push(point);
        }

        return new Level2Update({
            exchange: "CoinbasePro",
            base: market.base,
            quote: market.quote,
            timestampMs,
            asks,
            bids,
        });
    }

    protected _constructLevel3Update(msg, market: Market) {
        const timestampMs = moment(msg.time).valueOf();
        const sequenceId = msg.sequence;

        const asks = [];
        const bids = [];
        let point;

        switch (msg.type) {
            case "received":
                point = new Level3Point(msg.order_id, msg.price, msg.size, {
                    type: msg.type,
                    side: msg.side,
                    order_type: msg.order_type,
                    funds: msg.funds,
                });
                break;
            case "open":
                point = new Level3Point(msg.order_id, msg.price, msg.remaining_size, {
                    type: msg.type,
                    remaining_size: msg.remaining_size,
                });
                break;
            case "done":
                point = new Level3Point(msg.order_id, msg.price, msg.remaining_size, {
                    type: msg.type,
                    reason: msg.reason,
                    remaining_size: msg.remaining_size,
                });
                break;
            case "match":
                point = new Level3Point(msg.maker_order_id, msg.price, msg.size, {
                    type: msg.type,
                    trade_id: msg.trade_id,
                    maker_order_id: msg.maker_order_id,
                    taker_order_id: msg.taker_order_id,
                });
                break;
            case "change":
                point = new Level3Point(msg.order_id, msg.price, msg.new_size, {
                    type: msg.type,
                    new_size: msg.new_size,
                    old_size: msg.old_size,
                    new_funds: msg.new_funds,
                    old_funds: msg.old_funds,
                });
                break;
        }

        if (msg.side === "sell") asks.push(point);
        else bids.push(point);

        return new Level3Update({
            exchange: "CoinbasePro",
            base: market.base,
            quote: market.quote,
            sequenceId,
            timestampMs,
            asks,
            bids,
        });
    }
}
