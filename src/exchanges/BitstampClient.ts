/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import semaphore = require("semaphore");
import { Level2Point } from "../Level2Point";
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import { Level2Snapshot } from "../Level2Snapshots";
import { Market } from "../Market";
import { wait } from "../Util";
import * as https from "../Https";
import { NotImplementedFn } from "../NotImplementedFn";
import { Trade } from "../Trade";
import { Level2Update } from "../Level2Update";

/**
 * BistampClient v2 no longer uses Pusher. We can leverage the
 * BasicClient now instead of performing custom actions.
 *
 * Documentation for Version 2
 * https://www.bitstamp.net/websocket/v2/
 */
export class BitstampClient extends BasicClient {
    public requestSnapshot: boolean;
    public REST_REQUEST_DELAY_MS: number;

    protected _restSem: semaphore.Semaphore;

    protected _sendSubTicker = NotImplementedFn;
    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendUnsubTicker = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    constructor({ wssPath = "wss://ws.bitstamp.net", watcherMs }: ClientOptions = {}) {
        super(wssPath, "Bitstamp", undefined, watcherMs);
        this.requestSnapshot = true;
        this.hasTrades = true;
        this.hasLevel2Snapshots = true;
        this.hasLevel2Updates = true;
        this._restSem = semaphore(1);
        this.REST_REQUEST_DELAY_MS = 250;
    }

    protected _sendSubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                event: "bts:subscribe",
                data: {
                    channel: `live_trades_${remote_id}`,
                },
            }),
        );
    }

    protected _sendUnsubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                event: "bts:unsubscribe",
                data: {
                    channel: `live_trades_${remote_id}`,
                },
            }),
        );
    }

    protected _sendSubLevel2Snapshots(remote_id) {
        this._wss.send(
            JSON.stringify({
                event: "bts:subscribe",
                data: {
                    channel: `order_book_${remote_id}`,
                },
            }),
        );
    }

    protected _sendUnsubLevel2Snapshots(remote_id) {
        this._wss.send(
            JSON.stringify({
                event: "bts:unsubscribe",
                data: {
                    channel: `order_book_${remote_id}`,
                },
            }),
        );
    }

    protected _sendSubLevel2Updates(remote_id) {
        if (this.requestSnapshot)
            this._requestLevel2Snapshot(this._level2UpdateSubs.get(remote_id));
        this._wss.send(
            JSON.stringify({
                event: "bts:subscribe",
                data: {
                    channel: `diff_order_book_${remote_id}`,
                },
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id) {
        this._wss.send(
            JSON.stringify({
                event: "bts:unsubscribe",
                data: {
                    channel: `diff_order_book_${remote_id}`,
                },
            }),
        );
    }

    /////////////////////////////////////////////

    protected _onMessage(raw: any) {
        const msg = JSON.parse(raw);

        if (msg.event === "trade" && msg.channel.startsWith("live_trades")) {
            this._onTrade(msg);
            return;
        }

        if (msg.event === "data" && msg.channel.startsWith("order_book")) {
            this._onLevel2Snapshot(msg);
            return;
        }

        if (msg.event === "data" && msg.channel.startsWith("diff_order_book")) {
            this._onLevel2Update(msg);
            return;
        }

        // Handle forced reconnection events which may be triggered by
        // maintenance. Upon reconnection, the request will transition
        // to a new server.
        if (msg.event === "bts.request_reconnect") {
            this.reconnect();
            return;
        }
    }

    /**
   Process trade events
    {
      "data": {
        "microtimestamp": "1560180218394137",
        "amount": 0.0063150000000000003,
        "buy_order_id": 3486145418,
        "sell_order_id": 3486144483,
        "amount_str": "0.00631500",
        "price_str": "7917.13",
        "timestamp": "1560180218",
        "price": 7917.1300000000001,
        "type": 0,
        "id": 90350862
      },
      "event": "trade",
      "channel": "live_trades_btcusd"
    }

   */
    protected _onTrade(msg) {
        const remote_id = msg.channel.substr(msg.channel.lastIndexOf("_") + 1);

        const market = this._tradeSubs.get(remote_id);
        if (!market) return;

        const data = msg.data;
        const trade = new Trade({
            exchange: "Bitstamp",
            base: market.base,
            quote: market.quote,
            tradeId: data.id.toFixed(),
            unix: Math.round(parseInt(data.microtimestamp) / 1000), // convert to milli
            side: data.type === 1 ? "sell" : "buy",
            price: data.price_str,
            amount: data.amount_str,
            buyOrderId: data.buy_order_id,
            sellOrderId: data.sell_order_id,
        });

        this.emit("trade", trade, market);
    }

    /**
    Process level2 snapshot message
    {
      "data": {
        "timestamp": "1560181957",
        "microtimestamp": "1560181957623999",
        "bids": [
          ["7929.20", "1.10000000"],
          ["7927.07", "1.14028647"],
          ["7926.92", "0.02000000"],
          ["7926.31", "3.35799775"],
          ["7926.30", "0.10000000"]
        ],
        "asks": [
          ["7936.73", "0.50000000"],
          ["7937.10", "1.00000000"],
          ["7937.12", "0.02000000"],
          ["7937.13", "0.20101742"],
          ["7937.15", "0.06000000"]
        ]
      },
      "event": "data",
      "channel": "order_book_btcusd"
    }
   */
    protected _onLevel2Snapshot(msg) {
        const remote_id = msg.channel.substr(msg.channel.lastIndexOf("_") + 1);

        const market = this._level2SnapshotSubs.get(remote_id);
        if (!market) return;

        let { bids, asks, microtimestamp } = msg.data;
        bids = bids.map(([price, size]) => new Level2Point(price, size));
        asks = asks.map(([price, size]) => new Level2Point(price, size));

        const spot = new Level2Snapshot({
            exchange: "Bitstamp",
            base: market.base,
            quote: market.quote,
            timestampMs: Math.round(parseInt(microtimestamp) / 1000), // convert to milli
            bids,
            asks,
        });

        this.emit("l2snapshot", spot, market);
    }

    /**
    Process level2 update message

    {
      "data": {
        "timestamp": "1560182488",
        "microtimestamp": "1560182488522670",
        "bids": [
          ["7937.24", "0.00000000"],
          ["7937.10", "0.00000000"],
          ["7935.33", "3.14680000"],
          ["7935.01", "0.00000000"],
          ["7934.55", "0.00000000"]
        ],
        "asks": [
          ["7945.54", "0.10000000"],
          ["7945.64", "0.06000000"],
          ["7946.48", "4.00000000"],
          ["7947.75", "3.14700000"],
          ["7948.10", "0.00000000"]
        ]
      },
      "event": "data",
      "channel": "diff_order_book_btcusd"
    }
   */
    protected _onLevel2Update(msg) {
        const remote_id = msg.channel.substr(msg.channel.lastIndexOf("_") + 1);

        const market = this._level2UpdateSubs.get(remote_id);
        if (!market) return;

        let { bids, asks, microtimestamp } = msg.data;
        bids = bids.map(([price, size]) => new Level2Point(price, size));
        asks = asks.map(([price, size]) => new Level2Point(price, size));

        const update = new Level2Update({
            exchange: "Bitstamp",
            base: market.base,
            quote: market.quote,
            timestampMs: Math.round(parseInt(microtimestamp) / 1000), // convert to milli
            bids,
            asks,
        });

        this.emit("l2update", update, market);
    }

    /////////////////////////////////////////////
    // SNAPSHOTS
    /////////////////////////////////////////////

    protected _requestLevel2Snapshots() {
        if (this.requestSnapshot) {
            for (const market of Array.from(this._level2UpdateSubs.values())) {
                this._requestLevel2Snapshot(market);
            }
        }
    }

    protected _requestLevel2Snapshot(market: Market) {
        this._restSem.take(async () => {
            try {
                const remote_id = market.id;
                const uri = `https://www.bitstamp.net/api/v2/order_book/${remote_id}?group=1`;
                const raw: any = await https.get(uri);
                const timestampMs = raw.timestamp * 1000;
                const asks = raw.asks.map(p => new Level2Point(p[0], p[1]));
                const bids = raw.bids.map(p => new Level2Point(p[0], p[1]));
                const snapshot = new Level2Snapshot({
                    exchange: "Bitstamp",
                    base: market.base,
                    quote: market.quote,
                    timestampMs,
                    asks,
                    bids,
                });
                this.emit("l2snapshot", snapshot, market);
            } catch (ex) {
                this.emit("error", ex);
                this._requestLevel2Snapshot(market);
            } finally {
                await wait(this.REST_REQUEST_DELAY_MS);
                this._restSem.leave();
            }
        });
    }
}
