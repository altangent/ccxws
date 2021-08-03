/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import semaphore from "semaphore";
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import { Level2Point } from "../Level2Point";
import { Level2Update } from "../Level2Update";
import { Market } from "../Market";
import { NotImplementedFn } from "../NotImplementedFn";
import * as https from "../Https";
import { wait } from "../Util";
import { Level2Snapshot } from "../Level2Snapshots";
import { Trade } from "../Trade";
import moment from "moment";
import { Ticker } from "../Ticker";

export class BitflyerClient extends BasicClient {
    public requestSnapshot: boolean;
    public REST_REQUEST_DELAY_MS: number;

    protected _restSem: semaphore.Semaphore;

    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    constructor({
        wssPath = "wss://ws.lightstream.bitflyer.com/json-rpc",
        watcherMs,
    }: ClientOptions = {}) {
        super(wssPath, "BitFlyer", undefined, watcherMs);
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasLevel2Updates = true;
        this.requestSnapshot = true;
        this._restSem = semaphore(1);
        this.REST_REQUEST_DELAY_MS = 250;
    }

    protected _sendSubTicker(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "subscribe",
                params: {
                    channel: `lightning_ticker_${remote_id}`,
                },
            }),
        );
    }

    protected _sendUnsubTicker(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "unsubscribe",
                params: {
                    channel: `lightning_ticker_${remote_id}`,
                },
            }),
        );
    }

    protected _sendSubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "subscribe",
                params: {
                    channel: `lightning_executions_${remote_id}`,
                },
            }),
        );
    }

    protected _sendSubLevel2Updates(remote_id) {
        // this method is trigger on connections events... so safe to send snapshot request here
        if (this.requestSnapshot)
            this._requestLevel2Snapshot(this._level2UpdateSubs.get(remote_id));
        this._wss.send(
            JSON.stringify({
                method: "subscribe",
                params: {
                    channel: `lightning_board_${remote_id}`,
                },
            }),
        );
    }

    protected _sendUnsubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "unsubscribe",
                params: {
                    channel: `lightning_executions_${remote_id}`,
                },
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "unsubscribe",
                params: {
                    channel: `lightning_board_${remote_id}`,
                },
            }),
        );
    }

    protected _onMessage(data) {
        const parsed = JSON.parse(data);
        if (!parsed.params || !parsed.params.channel || !parsed.params.message) return;
        const { channel, message } = parsed.params;

        if (channel.startsWith("lightning_ticker_")) {
            const remote_id = channel.substr("lightning_ticker_".length);
            const market = this._tickerSubs.get(remote_id);
            if (!market) return;

            const ticker = this._createTicker(message, market);
            this.emit("ticker", ticker, market);
            return;
        }

        // trades
        if (channel.startsWith("lightning_executions_")) {
            const remote_id = channel.substr("lightning_executions_".length);
            const market = this._tradeSubs.get(remote_id);
            if (!market) return;

            for (const datum of message) {
                const trade = this._createTrades(datum, market);
                this.emit("trade", trade, market);
            }
        }

        // orderbook
        if (channel.startsWith("lightning_board_")) {
            const remote_id = channel.substr("lightning_board_".length);
            const market = this._level2UpdateSubs.get(remote_id);
            if (!market) return;

            const update = this._createLevel2Update(message, market);
            this.emit("l2update", update, market);
        }
    }

    protected _createTicker(data, market) {
        const {
            timestamp,
            best_bid,
            best_ask,
            best_bid_size,
            best_ask_size,
            ltp,
            volume,
            volume_by_product,
        } = data;
        return new Ticker({
            exchange: "bitFlyer",
            base: market.base,
            quote: market.quote,
            timestamp: moment.utc(timestamp).valueOf(),
            last: ltp.toFixed(8),
            volume: volume.toFixed(8),
            quoteVolume: volume_by_product.toFixed(8),
            bid: best_bid.toFixed(8),
            bidVolume: best_bid_size.toFixed(8),
            ask: best_ask.toFixed(8),
            askVolume: best_ask_size.toFixed(8),
        });
    }

    protected _createTrades(datum, market) {
        let {
            size,
            side,
            exec_date,
            price,
            id,
            buy_child_order_acceptance_id,
            sell_child_order_acceptance_id,
        } = datum;

        side = side.toLowerCase();
        const unix = moment(exec_date).valueOf();

        return new Trade({
            exchange: "bitFlyer",
            base: market.base,
            quote: market.quote,
            tradeId: id.toFixed(),
            unix,
            side: side.toLowerCase(),
            price: price.toFixed(8),
            amount: size.toFixed(8),
            buyOrderId: buy_child_order_acceptance_id,
            sellOrderId: sell_child_order_acceptance_id,
        });
    }

    protected _createLevel2Update(msg: any, market: Market) {
        const asks = msg.asks.map(p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)));
        const bids = msg.bids.map(p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)));

        return new Level2Update({
            exchange: "bitFlyer",
            base: market.base,
            quote: market.quote,
            asks,
            bids,
        });
    }

    protected _requestLevel2Snapshot(market: Market) {
        this._restSem.take(async () => {
            try {
                const remote_id = market.id;
                const uri = `https://api.bitflyer.com/v1/board?product_code=${remote_id}`;
                const raw = (await https.get(uri)) as any;
                const asks = raw.asks.map(
                    p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)),
                );
                const bids = raw.bids.map(
                    p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)),
                );
                const snapshot = new Level2Snapshot({
                    exchange: "bitFlyer",
                    base: market.base,
                    quote: market.quote,
                    asks,
                    bids,
                });
                this.emit("l2snapshot", snapshot, market);
            } catch (ex) {
                this._onError(ex);
                this._requestLevel2Snapshot(market);
            } finally {
                await wait(this.REST_REQUEST_DELAY_MS);
                this._restSem.leave();
            }
        });
    }
}
