/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-empty-function */
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import { Level3Point } from "../Level3Point";
import { Level3Snapshot } from "../Level3Snapshot";
import * as https from "../Https";
import { Trade } from "../Trade";
import { Level3Update } from "../Level3Update";
import { NotImplementedFn } from "../NotImplementedFn";

export type LedgerXClientOptions = ClientOptions & {
    apiKey?: string;
};

/**
 * LedgerX is defined in https://docs.ledgerx.com/reference#connecting
 * This socket uses a unified stream for ALL market data. So we will leverage
 * subscription filtering to only reply with values that of are of interest.
 */
export class LedgerXClient extends BasicClient {
    public runId: number;
    public apiKey: string;

    constructor({
        wssPath = "wss://api.ledgerx.com/ws?token=",
        apiKey,
        watcherMs,
    }: LedgerXClientOptions = {}) {
        super(wssPath + apiKey, "LedgerX", undefined, watcherMs);

        this.hasTrades = true;
        this.hasLevel3Updates = true;
        this.runId = 0;
        this.apiKey = apiKey;
    }

    protected _sendSubTrades() {}

    protected _sendUnsubTrades() {}

    protected _sendSubLevel3Updates(remote_id, market) {
        this._requestLevel3Snapshot(market);
    }

    protected _sendUnSubLevel3Updates() {}

    protected _sendSubTicker = NotImplementedFn;
    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendUnsubTicker = NotImplementedFn;
    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel2Updates = NotImplementedFn;
    protected _sendUnsubLevel2Updates = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    protected _onMessage(msg: string) {
        this.emit("raw", msg);

        const json = JSON.parse(msg);

        if (json.type === "auth_success") {
            return;
        }

        if (json.type === "book_top") {
            return;
        }

        if (json.positions !== undefined) {
            return;
        }

        if (json.collateral !== undefined) {
            return;
        }

        if (json.type === "exposure_reports") {
            return;
        }

        if (json.type === "heartbeat") {
            this._watcher.markAlive();

            // update the run_id if it's changed
            if (this.runId !== json.run_id) {
                this.runId = json.run_id;
            }
            return;
        }

        if (json.type === "action_report") {
            // insert event
            if (json.status_type === 200) {
                const market =
                    this._level3UpdateSubs.get(json.contract_id) ||
                    this._level3UpdateSubs.get(json.contract_id.toString());
                if (!market) return;

                const update = this._constructL3Insert(json, market);
                this.emit("l3update", update, market, json);
                return;
            }

            // trade event, filled either partial or fully
            if (json.status_type === 201) {
                // check for trade subscription
                let market =
          this._tradeSubs.get(json.contract_id) ||
          this._tradeSubs.get(json.contract_id.toString()); // prettier-ignore
                if (market) {
                    const trade = this._constructTrade(json, market);
                    this.emit("trade", trade, market, json);
                }

                // check for l3 subscription
                market =
                    this._level3UpdateSubs.get(json.contract_id) ||
                    this._level3UpdateSubs.get(json.contract_id.toString());
                if (market) {
                    const update = this._constructL3Trade(json, market);
                    this.emit("l3update", update, market, json);
                }

                return;
            }

            // cancel event
            if (json.status_type === 203) {
                const market =
                    this._level3UpdateSubs.get(json.contract_id) ||
                    this._level3UpdateSubs.get(json.contract_id.toString());
                if (!market) return;

                const update = this._constructL3Cancel(json, market);
                this.emit("l3update", update, market, json);
                return;
            }

            // cancelled and replaced event
            if (json.status_type === 204) {
                const market =
                    this._level3UpdateSubs.get(json.contract_id) ||
                    this._level3UpdateSubs.get(json.contract_id.toString());
                if (!market) return;

                const update = this._constructL3Replace(json, market);
                this.emit("l3update", update, market, json);
                return;
            }
        }
    }

    /**
     * Obtains the orderbook via REST
     */
    protected async _requestLevel3Snapshot(market) {
        try {
            const uri = `https://trade.ledgerx.com/api/book-states/${market.id}?token=${this.apiKey}`;
            const { data } = await https.get(uri);
            const sequenceId = data.clock;
            const asks = [];
            const bids = [];
            for (const row of data.book_states) {
                const orderId = row.mid;
                const price = row.price.toFixed(2);
                const size = row.size.toFixed();
                const point = new Level3Point(orderId, price, size);
                if (row.is_ask) asks.push(point);
                else bids.push(point);
            }
            const snapshot = new Level3Snapshot({
                exchange: this.name,
                base: market.base,
                quote: market.quote,
                sequenceId,
                asks,
                bids,
            });
            this.emit("l3snapshot", snapshot, market);
        } catch (ex) {
            // TODO handle this properly
            this.emit("error", ex);
        }
    }

    /**
   {
      mid: 'f4c34b09de0b4064a33b7b46f8180022',
      filled_size: 5,
      size: 0,
      inserted_price: 0,
      updated_time: 1597173352257155800,
      inserted_size: 0,
      timestamp: 1597173352257176800,
      ticks: 78678024531551,
      price: 0,
      original_price: 16000,
      status_type: 201,
      order_type: 'customer_limit_order',
      status_reason: 52,
      filled_price: 16000,
      is_volatile: false,
      clock: 24823,
      vwap: 16000,
      is_ask: false,
      inserted_time: 1597173352257155800,
      type: 'action_report',
      original_size: 5,
      contract_id: 22204639
    }
    {
      mid: '885be81549974faf88e4430f6046513d',
      filled_size: 5,
      size: 0,
      inserted_price: 0,
      updated_time: 1597164994095326700,
      inserted_size: 0,
      timestamp: 1597173352258250800,
      ticks: 78678025605522,
      price: 0,
      original_price: 16000,
      status_type: 201,
      order_type: 'customer_limit_order',
      status_reason: 0,
      filled_price: 16000,
      is_volatile: false,
      clock: 24824,
      vwap: 16000,
      is_ask: true,
      inserted_time: 1597164994095326700,
      type: 'action_report',
      original_size: 10,
      contract_id: 22204639
    }
   */
    protected _constructTrade(msg, market) {
        let buyOrderId;
        let sellOrderId;
        if (msg.is_ask) sellOrderId = msg.mid;
        else buyOrderId = msg.mid;
        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: undefined, // doesn't emit or match REST API
            unix: Math.floor(msg.timestamp / 1e6),
            side: msg.is_ask ? "sell" : "buy",
            price: msg.filled_price.toFixed(8),
            amount: msg.filled_size.toFixed(8),
            buyOrderId,
            sellOrderId,
            open_interest: msg.open_interest,
        });
    }

    /**
   * 200 - A resting limit order of size inserted_size @ price
   * inserted_price was inserted into book depth.
   {
      inserted_time: 1597176131501325800,
      timestamp: 1597176131501343700,
      filled_size: 0,
      ticks: 81457268698527,
      size: 1000,
      contract_id: 22202469,
      filled_price: 0,
      inserted_price: 165100,
      inserted_size: 1000,
      vwap: 0,
      is_volatile: true,
      mid: 'eecd8297c1dc42f1985f67c909540631',
      original_price: 165100,
      order_type: 'customer_limit_order',
      updated_time: 1597176131501325800,
      original_size: 1000,
      status_type: 200,
      status_reason: 0,
      type: 'action_report',
      price: 165100,
      clock: 260,
      is_ask: false
    }
   */
    protected _constructL3Insert(msg, market) {
        const price = msg.price.toFixed(8);
        const size = msg.inserted_size.toFixed(8);
        const point = new Level3Point(msg.mid, price, size, {
            order_type: msg.order_type,
            status_type: msg.status_type,
            status_reason: msg.status_reason,
            is_volatile: msg.is_volatile,
            timestamp: msg.timestamp,
            ticks: msg.ticks,
            inserted_time: msg.inserted_time,
            updated_time: msg.updated_time,
            original_price: msg.original_price,
            original_size: msg.original_size,
            inserted_price: msg.inserted_price,
            inserted_size: msg.inserted_size,
            filled_price: msg.filled_price,
            filled_size: msg.filled_size,
            price: msg.price,
            size: msg.size,
            vwap: msg.vwap,
        });

        const asks = [];
        const bids = [];

        if (msg.is_ask) asks.push(point);
        else bids.push(point);

        return new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: msg.clock,
            timestampMs: Math.floor(msg.inserted_time / 1e6),
            runId: this.runId,
            asks,
            bids,
        });
    }

    /**
   * 201 - A cross of size filled_size @ price filled_price occurred.
   * Subtract filled_size from the resting size for this order.
  {
      mid: '885be81549974faf88e4430f6046513d',
      filled_size: 5,
      size: 0,
      inserted_price: 0,
      updated_time: 1597164994095326700,
      inserted_size: 0,
      timestamp: 1597173352258250800,
      ticks: 78678025605522,
      price: 0,
      original_price: 16000,
      status_type: 201,
      order_type: 'customer_limit_order',
      status_reason: 0,
      filled_price: 16000,
      is_volatile: false,
      clock: 24824,
      vwap: 16000,
      is_ask: true,
      inserted_time: 1597164994095326700,
      type: 'action_report',
      original_size: 10,
      contract_id: 22204639
    }
  */
    protected _constructL3Trade(msg, market) {
        const price = msg.original_price.toFixed(8);
        const size = (msg.original_size - msg.filled_size).toFixed(8);
        const point = new Level3Point(msg.mid, price, size, {
            order_type: msg.order_type,
            status_type: msg.status_type,
            status_reason: msg.status_reason,
            is_volatile: msg.is_volatile,
            timestamp: msg.timestamp,
            ticks: msg.ticks,
            inserted_time: msg.inserted_time,
            updated_time: msg.updated_time,
            original_price: msg.original_price,
            original_size: msg.original_size,
            inserted_price: msg.inserted_price,
            inserted_size: msg.inserted_size,
            filled_price: msg.filled_price,
            filled_size: msg.filled_size,
            price: msg.price,
            size: msg.size,
            vwap: msg.vwap,
            open_interest: msg.open_interest,
        });

        const asks = [];
        const bids = [];

        if (msg.is_ask) asks.push(point);
        else bids.push(point);

        return new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: msg.clock,
            timestampMs: Math.floor(msg.inserted_time / 1e6),
            runId: this.runId,
            asks,
            bids,
        });
    }

    /**
   * 203 - An order was cancelled. Remove this order from book depth.
   {
      inserted_time: 1597176853952381700,
      timestamp: 1597176857137740800,
      filled_size: 0,
      ticks: 82182905095242,
      size: 0,
      contract_id: 22204631,
      filled_price: 0,
      inserted_price: 0,
      inserted_size: 0,
      vwap: 0,
      is_volatile: true,
      mid: 'b623fdd6fae14fcbbcb9ab3b6b9b3771',
      original_price: 51300,
      order_type: 'customer_limit_order',
      updated_time: 1597176853952381700,
      original_size: 1,
      status_type: 203,
      status_reason: 0,
      type: 'action_report',
      price: 0,
      clock: 506,
      is_ask: false
    }
   */
    protected _constructL3Cancel(msg, market) {
        const price = msg.original_price.toFixed(8);
        const size = (0).toFixed(8);
        const point = new Level3Point(msg.mid, price, size, {
            order_type: msg.order_type,
            status_type: msg.status_type,
            status_reason: msg.status_reason,
            is_volatile: msg.is_volatile,
            timestamp: msg.timestamp,
            ticks: msg.ticks,
            inserted_time: msg.inserted_time,
            updated_time: msg.updated_time,
            original_price: msg.original_price,
            original_size: msg.original_size,
            inserted_price: msg.inserted_price,
            inserted_size: msg.inserted_size,
            filled_price: msg.filled_price,
            filled_size: msg.filled_size,
            price: msg.price,
            size: msg.size,
            vwap: msg.vwap,
            open_interest: msg.open_interest,
        });

        const asks = [];
        const bids = [];

        if (msg.is_ask) asks.push(point);
        else bids.push(point);

        return new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: msg.clock,
            timestampMs: Math.floor(msg.inserted_time / 1e6),
            runId: this.runId,
            asks,
            bids,
        });
    }

    /**
   * 204 - An order was cancelled and replaced. The new order retains the
   * existing mid, and can only reflect an update in size and not price.
   * Overwrite the resting order size with inserted_size.
   *
   {
    "status_type": 204,
    "inserted_size": 12,
    "original_price": 59000,
    "open_interest": 121,
    "filled_size": 0,
    "updated_time": 1623074768372895949,
    "clock": 40011,
    "size": 12,
    "timestamp": 1623074768372897897,
    "status_reason": 0,
    "vwap": 0,
    "inserted_time": 1623074764668677182,
    "price": 59000,
    "type": "action_report",
    "is_ask": true,
    "original_size": 12,
    "order_type": "customer_limit_order",
    "is_volatile": true,
    "ticks": 25980094140252686,
    "filled_price": 0,
    "mid": "c071baaa458a411db184cb6874e86d69",
    "inserted_price": 59000,
    "contract_id": 22216779
  }
   */
    protected _constructL3Replace(msg, market) {
        const price = msg.original_price.toFixed(8);
        const size = msg.inserted_size.toFixed(8);
        const point = new Level3Point(msg.mid, price, size, {
            order_type: msg.order_type,
            status_type: msg.status_type,
            status_reason: msg.status_reason,
            is_volatile: msg.is_volatile,
            timestamp: msg.timestamp,
            ticks: msg.ticks,
            inserted_time: msg.inserted_time,
            updated_time: msg.updated_time,
            original_price: msg.original_price,
            original_size: msg.original_size,
            inserted_price: msg.inserted_price,
            inserted_size: msg.inserted_size,
            filled_price: msg.filled_price,
            filled_size: msg.filled_size,
            price: msg.price,
            size: msg.size,
            vwap: msg.vwap,
            open_interest: msg.open_interest,
        });

        const asks = [];
        const bids = [];

        if (msg.is_ask) asks.push(point);
        else bids.push(point);

        return new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            sequenceId: msg.clock,
            timestampMs: Math.floor(msg.inserted_time / 1e6),
            runId: this.runId,
            asks,
            bids,
        });
    }
}
