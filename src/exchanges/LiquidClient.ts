/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-implied-eval */
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import * as https from "../Https";
import { Level2Point } from "../Level2Point";
import { Level2Update } from "../Level2Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export type LiquidClientOptions = ClientOptions & {
    autoloadSymbolMaps?: boolean;
    requestSnapshot?: boolean;
};

/**
 * Liquid client as implemented by:
 * https://developers.liquid.com/#public-channels
 */
export class LiquidClient extends BasicClient {
    public requestSnapshot: boolean;
    protected productIdMap: Map<string, string>;
    protected _pingInterval: NodeJS.Timeout;

    constructor({
        wssPath = "wss://tap.liquid.com/app/LiquidTapClient",
        autoloadSymbolMaps = true,
        requestSnapshot = false,
        watcherMs,
    }: LiquidClientOptions = {}) {
        super(wssPath, "Liquid", undefined, watcherMs);

        this.requestSnapshot = requestSnapshot;
        this.hasTrades = true;
        this.hasTickers = true;
        this.hasLevel2Updates = true;

        this.productIdMap = new Map();
        if (autoloadSymbolMaps) {
            this.loadSymbolMaps().catch(err => this.emit("error", err));
        }
    }

    protected _beforeConnect() {
        this._wss.on("connected", this._startPing.bind(this));
        this._wss.on("disconnected", this._stopPing.bind(this));
        this._wss.on("closed", this._stopPing.bind(this));
    }

    protected _startPing() {
        clearInterval(this._pingInterval);
        this._pingInterval = setInterval(this._sendPing.bind(this), 60000);
    }

    protected _stopPing() {
        clearInterval(this._pingInterval);
    }

    protected _sendPing() {
        if (this._wss) {
            this._wss.send(JSON.stringify({ event: "pusher:ping", data: {} }));
        }
    }

    /**
   * Liquid endpoints brilliantly/s require you to include the product id
   * in addition to the market symbol. So we need a way to reference this.
   * Results from the products API look like:
   * {
      "id": 5,
      "product_type": "CurrencyPair",
      "code": "CASH",
      "name": "CASH Trading",
      "market_ask": "48203.05",
      "market_bid": "48188.15",
      "indicator": -1,
      "currency": "JPY",
      "currency_pair_code": "BTCJPY",
      "symbol": "¥",
      "fiat_minimum_withdraw": "1500.0",
      "pusher_channel": "product_cash_btcjpy_5",
      "taker_fee": "0.0",
      "maker_fee": "0.0",
      "low_market_bid": "47630.99",
      "high_market_ask": "48396.71",
      "volume_24h": "2915.627366519999999998",
      "last_price_24h": "48217.2",
      "last_traded_price": "48203.05",
      "last_traded_quantity": "1.0",
      "quoted_currency": "JPY",
      "base_currency": "BTC",
      "exchange_rate": "0.009398151671149725",
      "timestamp": "1576739219.195353100"
    },
   */
    protected async loadSymbolMaps() {
        const uri = "https://api.liquid.com/products";
        const results: any = await https.get(uri);
        for (const result of results) {
            this.productIdMap.set(result.currency_pair_code.toLowerCase(), result.id);
        }
    }

    protected _sendSubTicker(remote_id: string) {
        remote_id = remote_id.toLowerCase();
        const product_id = this.productIdMap.get(remote_id);
        this._wss.send(
            JSON.stringify({
                event: "pusher:subscribe",
                data: {
                    channel: `product_cash_${remote_id}_${product_id}`,
                },
            }),
        );
    }

    protected _sendUnsubTicker(remote_id: string) {
        remote_id = remote_id.toLowerCase();
        const product_id = this.productIdMap.get(remote_id);
        this._wss.send(
            JSON.stringify({
                event: "pusher:unsubscribe",
                data: {
                    channel: `product_cash_${remote_id}_${product_id}`,
                },
            }),
        );
    }

    protected _sendSubTrades(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                event: "pusher:subscribe",
                data: {
                    channel: `executions_cash_${remote_id.toLowerCase()}`,
                },
            }),
        );
    }

    protected _sendUnsubTrades(remote_id: string) {
        this._wss.send(
            JSON.stringify({
                event: "pusher:unsubscribe",
                data: {
                    channel: `executions_cash_${remote_id.toLowerCase()}`,
                },
            }),
        );
    }

    protected _sendSubLevel2Updates(remote_id: string) {
        remote_id = remote_id.toLowerCase();
        this._wss.send(
            JSON.stringify({
                event: "pusher:subscribe",
                data: {
                    channel: `price_ladders_cash_${remote_id}_buy`,
                },
            }),
        );
        this._wss.send(
            JSON.stringify({
                event: "pusher:subscribe",
                data: {
                    channel: `price_ladders_cash_${remote_id}_sell`,
                },
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id: string) {
        remote_id = remote_id.toLowerCase();
        this._wss.send(
            JSON.stringify({
                event: "pusher:unsubscribe",
                data: {
                    channel: `price_ladders_cash_${remote_id}_buy`,
                },
            }),
        );
        this._wss.send(
            JSON.stringify({
                event: "pusher:unsubscribe",
                data: {
                    channel: `price_ladders_cash_${remote_id}_sell`,
                },
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

    /////////////////////////////////////////////

    protected _onMessage(raw: string) {
        let msg: any;
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            this.emit("error", e);
            return;
        }

        // success messages look like:
        // {
        //   channel: 'executions_cash_btcjpy',
        //   data: {},
        //   event: 'pusher_internal:subscription_succeeded'
        // }

        if (msg.channel) {
            if (msg.channel.startsWith("executions_cash_")) {
                this._onTrade(msg);
                return;
            }

            if (msg.channel.startsWith("product_cash_")) {
                this._onTicker(msg);
                return;
            }

            if (msg.channel.startsWith("price_ladders_cash_")) {
                this._onOrderBook(msg);
                return;
            }
        }
    }

    /**
     * Ticker message in the format:
     * {
     *   channel: 'product_cash_btcjpy_5',
     *   data: '{"base_currency":"BTC","btc_minimum_withdraw":null,"cfd_enabled":false,"code":"CASH","currency":"JPY","currency_pair_code":"BTCJPY","disabled":false,"fiat_minimum_withdraw":null,"high_market_ask":"772267.0","id":"5","indicator":-1,"last_event_timestamp":"1587066660.016599696","last_price_24h":"725777.0","last_traded_price":"764242.0","last_traded_quantity":"0.05805448","low_market_bid":"698763.0","margin_enabled":false,"market_ask":"764291.0","market_bid":"764242.0","name":" CASH Trading","perpetual_enabled":false,"product_type":"CurrencyPair","pusher_channel":"product_cash_btcjpy_5","quoted_currency":"JPY","symbol":"¥","tick_size":"1.0","timestamp":"1587066660.016599696","volume_24h":"20739.2916905799999999"}',
     *   event: 'updated'
     * }
     */
    protected _onTicker(msg) {
        let data: any;
        try {
            data = JSON.parse(msg.data);
        } catch (e) {
            return;
        }

        const remote_id = /(product_cash_)(\w+)_\d+/.exec(msg.channel)[2];
        const market = this._tickerSubs.get(remote_id);
        if (!market) return;

        const open = Number(data.last_price_24h);
        const close = Number(data.last_traded_price);
        const change = close - open;
        const changePercent = (change / open) * 100;

        const ticker = new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp: Math.round(Number(data.timestamp) * 1000),
            last: data.last_traded_price,
            open: data.last_price_24h,
            high: undefined,
            low: undefined,
            volume: data.volume_24h,
            quoteVolume: undefined,
            change: change.toFixed(8),
            changePercent: changePercent.toFixed(2),
            bid: data.market_bid,
            bidVolume: undefined,
            ask: data.market_ask,
            askVolume: undefined,
        });

        this.emit("ticker", ticker, market);
    }

    /**
     * Trade message in the format:
     * {
     *   channel: 'executions_cash_btcjpy',
     *   data: '{"created_at":1587056568,"id":297058474,"price":757584.0,"quantity":0.178,"taker_side":"sell"}',
     *   event: 'created'
     * }
     */
    protected _onTrade(msg) {
        let data;
        try {
            data = JSON.parse(msg.data);
        } catch (e) {
            return;
        }

        const remote_id = msg.channel.substr(msg.channel.lastIndexOf("_") + 1);

        const market = this._tradeSubs.get(remote_id);
        if (!market) return;

        const trade = new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: data.id.toFixed(),
            unix: parseInt(data.created_at) * 1000,
            side: data.taker_side == "buy" ? "buy" : "sell",
            price: data.price.toFixed(8),
            amount: data.quantity.toFixed(8),
            buyOrderId: undefined,
            sellOrderId: undefined,
        });

        this.emit("trade", trade, market);
    }

    /**
   * {
        channel: 'price_ladders_cash_btcjpy_buy',
        data: '[["755089.00000","0.03319269"],["755087.00000","0.00593314"],["755068.00000","0.00150000"],["755060.00000","0.00100000"],["755059.00000","0.03244832"],["755050.00000","0.03244969"],["755044.00000","0.47500000"],["754978.00000","0.47500000"],["754941.00000","0.00100000"],["754929.00000","0.00100000"],["754913.00000","0.05409938"],["754891.00000","0.37872763"],["754890.00000","0.03974826"],["754869.00000","0.04059000"],["754850.00000","0.05000000"],["754835.00000","0.03300000"],["754834.00000","0.25000000"],["754776.00000","0.03000000"],["754738.00000","0.00960000"],["754715.00000","0.00500000"],["754713.00000","0.05000000"],["754701.00000","0.03244949"],["754698.00000","0.00100000"],["754695.00000","0.03245118"],["754685.00000","0.48000000"],["754674.00000","0.00900000"],["754625.00000","0.50000013"],["754611.00000","0.10000000"],["754604.00000","0.05000000"],["754602.00000","0.05000000"],["754601.00000","0.03000000"],["754593.00000","0.01000000"],["754581.00000","0.01000000"],["754578.00000","0.01020000"],["754479.00000","0.01840000"],["754469.00000","1.00000013"],["754401.00000","0.02500000"],["754400.00000","0.01000000"],["754398.00000","0.03000000"],["754390.00000","0.25000000"]]',
        event: 'updated'
      }
   */
    protected _onOrderBook(msg) {
        let data;
        try {
            data = JSON.parse(msg.data);
        } catch (e) {
            return;
        }

        const remote_id = /(price_ladders_cash_)(\w+)_(buy|sell)+/.exec(msg.channel)[2];
        const market = this._level2UpdateSubs.get(remote_id);
        if (!market) return;

        const side = msg.channel.endsWith("buy") ? "buy" : "sell";
        const points = data.map(([price, amount]) => new Level2Point(price, amount));

        let bids;
        let asks;

        if (side == "buy") {
            bids = points;
            asks = [];
        } else {
            bids = [];
            asks = points;
        }

        const update = new Level2Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            bids,
            asks,
        });

        this.emit("l2update", update, market);
    }
}
