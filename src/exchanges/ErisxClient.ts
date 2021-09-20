/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import moment = require("moment");
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import * as jwt from "../Jwt";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Level3Point } from "../Level3Point";
import { Level3Snapshot } from "../Level3Snapshot";
import { Level3Update } from "../Level3Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Trade } from "../Trade";

export type ErisXClientOptions = ClientOptions & {
    apiKey?: string;
    apiSecret?: string;
    l2depth?: number;
};

/**
 * ErisX has limited market data and presently only supports trades and
 * level3 order books. It requires authenticating with a token to view
 * the market data, which is performed on initial connection. ErisX also
 * requires a unique "correlationId" for each request sent to the server.
 * Requests are limited to 40 per second.
 */
export class ErisXClient extends BasicClient {
    public apiKey: string;
    public apiSecret: string;
    public l2depth: number;
    protected _messageId: number;

    constructor({
        wssPath = "wss://trade-api.erisx.com/",
        watcherMs = 600000,
        apiKey,
        apiSecret,
        l2depth = 20,
    }: ErisXClientOptions = {}) {
        super(wssPath, "ErisX", undefined, watcherMs);

        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.hasTrades = true;
        this.hasLevel2Snapshots = true;
        this.hasLevel3Updates = true;
        this.l2depth = l2depth;
        this._messageId = 0;
    }

    public fetchSecurities() {
        this._wss.send(
            JSON.stringify({
                correlation: "SecurityList",
                type: "SecurityList",
                securityGroup: "ALL",
            }),
        );
    }

    protected _onConnected() {
        this._sendAuthentication();
    }

    protected _sendAuthentication() {
        this._wss.send(
            JSON.stringify({
                correlation: this._nextId(),
                type: "AuthenticationRequest",
                token: this._createToken(),
            }),
        );
    }

    protected _nextId() {
        return (++this._messageId).toString();
    }

    protected _createToken() {
        const payload = {
            iat: Date.now(),
            sub: this.apiKey,
        };
        return jwt.hs256(payload, this.apiSecret);
    }

    protected _sendSubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                correlation: this._nextId(),
                type: "MarketDataSubscribe",
                symbol: remote_id,
                tradeOnly: true,
            }),
        );
    }

    protected _sendUnsubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                correlation: this._nextId(),
                type: "MarketDataUnsubscribe",
                symbol: remote_id,
                tradeOnly: true,
            }),
        );
    }

    protected _sendSubLevel2Snapshots(remote_id) {
        this._wss.send(
            JSON.stringify({
                correlation: this._nextId(),
                type: "TopOfBookMarketDataSubscribe",
                symbol: remote_id,
                topOfBookDepth: this.l2depth,
            }),
        );
    }

    protected _sendUnsubLevel2Snapshots(remote_id) {
        this._wss.send(
            JSON.stringify({
                correlation: this._nextId(),
                type: "TopOfBookMarketDataUnsubscribe",
                symbol: remote_id,
                topOfBookDepth: this.l2depth,
            }),
        );
    }

    protected _sendSubLevel3Updates(remote_id) {
        this._wss.send(
            JSON.stringify({
                correlation: this._nextId(),
                type: "MarketDataSubscribe",
                symbol: remote_id,
            }),
        );
    }

    protected _sendUnsubLevel3Snapshots(remote_id) {
        this._wss.send(
            JSON.stringify({
                correlation: this._nextId(),
                type: "MarketDataUnsubscribe",
                symbol: remote_id,
            }),
        );
    }

    protected _sendSubTicker = NotImplementedFn;
    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendUnsubTicker = NotImplementedFn;
    protected _sendSubLevel2Updates = NotImplementedFn;
    protected _sendUnsubLevel2Updates = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    protected _onMessage(raw) {
        const msg: any = JSON.parse(raw);

        // authentication
        if (msg.type === "AuthenticationResult") {
            if (msg.success) {
                super._onConnected();
            } else {
                this.emit("error", new Error("Authentication failed"));
            }
            return;
        }

        // logout
        if (msg.type === "Logout") {
            this.emit("error", new Error("Session has been logged out"));
            return;
        }

        // unsolicited
        if (msg.type === "OFFLINE") {
            this.emit("error", new Error("Exchange is offline"));
            return;
        }

        // status
        if (msg.type === "INFO_MESSAGE") {
            return;
        }

        // securities
        if (msg.type === "SecuritiesResponse") {
            this.emit("markets", msg.securities);
            return;
        }

        // trade
        if (msg.type === "MarketDataIncrementalRefreshTrade") {
            const market = this._tradeSubs.get(msg.symbol);
            if (!market) return;

            const trades = this._constructTrades(msg, market);
            for (const trade of trades) {
                this.emit("trade", trade, market);
            }
            return;
        }

        // l2 snapshot
        if (msg.type === "TopOfBookMarketData") {
            const market = this._level2SnapshotSubs.get(msg.symbol);
            if (!market) return;

            const snapshot = this._constructLevel2Snapshot(msg, market);
            this.emit("l2snapshot", snapshot, market);
            return;
        }

        // l3
        if (msg.type === "MarketDataIncrementalRefresh") {
            const market = this._level3UpdateSubs.get(msg.symbol);
            if (!market) return;

            // snapshot
            if (msg.endFlag === null) {
                const snapshot = this._constructLevel3Snapshot(msg, market);
                this.emit("l3snapshot", snapshot, market);
            }
            // update
            else {
                const update = this._constructLevel3Update(msg, market);
                this.emit("l3update", update, market);
            }
            return;
        }
    }

    /**
   {
      "correlation": "15978410832102",
      "type": "MarketDataIncrementalRefreshTrade",
      "symbol": "LTC/USD",
      "sendingTime": "20200819-12:44:50.896",
      "trades": [{
        "updateAction": "NEW",
        "price": 64.2,
        "currency": "LTC",
        "tickerType": "PAID",
        "transactTime": "20200819-12:44:50.872994129",
        "size": 2.0,
        "symbol": "LTC/USD",
        "numberOfOrders": 1
      }],
      "endFlag":  "END_OF_TRADE"
    }
   */
    protected _constructTrades(msg, market) {
        return msg.trades.map(p => this._constructTrade(p, market));
    }

    /**
   {
      "updateAction": "NEW",
      "price": 64.2,
      "currency": "LTC",
      "tickerType": "PAID",
      "transactTime": "20200819-12:44:50.872994129",
      "size": 2.0,
      "symbol": "LTC/USD",
      "numberOfOrders": 1
   }
   */
    protected _constructTrade(msg, market) {
        const timestamp = moment.utc(msg.transactTime, "YYYYMMDD-hh:mm:ss.SSSSSSSSS");
        const unix = timestamp.valueOf();
        const tradeId = msg.transactTime.replace(/[-:.]/g, "");
        const amount = msg.size.toFixed(8);
        const price = msg.price.toFixed(8);
        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId,
            unix,
            price,
            amount,
            raw: msg,
        });
    }

    /**
   {
    "correlation": "15978412650812",
    "type": "TopOfBookMarketData",
    "bids": [
        {
            "action": "NEW",
            "count": 1,
            "totalVolume": 1.0,
            "price": 413.2,
            "lastUpdate": "20200819-12:47:49.975"
        },
        {
            "action": "UPDATE",
            "count": 2,
            "totalVolume": 2.00,
            "price": 412.9,
            "lastUpdate": "20200819-12:47:39.984"
        }
    ],
    "offers": [
        {
            "action": "NO CHANGE",
            "count": 1,
            "totalVolume": 1.00,
            "price": 413.3,
            "lastUpdate": "20200819-12:47:40.166"
        },
        {
            "action": "NO CHANGE",
            "count": 1,
            "totalVolume": 1.56,
            "price": 413.4,
            "lastUpdate": "20200819-12:47:20.196"
        }
    ],
    "symbol": "ETH/USD"
    }
   */
    protected _constructLevel2Snapshot(msg, market) {
        const map = p =>
            new Level2Point(
                p.price.toFixed(8),
                p.totalVolume.toFixed(8),
                p.count,
                undefined,
                moment.utc(p.lastUpdate, "YYYYMMDD-hh:mm:ss.SSSSSSSSS").valueOf(),
            );
        const bids = msg.bids.map(map);
        const asks = msg.offers.map(map);
        return new Level2Snapshot({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            asks,
            bids,
        });
    }

    /**
   {
      "correlation": "4",
      "type": "MarketDataIncrementalRefresh",
      "symbol": "BTC/USD",
      "sendingTime": "20201007-17:37:40.588",
      "bids": [
          {
              "id": "1000000fd05b8",
              "updateAction": "NEW",
              "price": 10632.2,
              "amount": 1.6,
              "symbol": "BTC/USD"
          },
          {
              "id": "1000000fd05a0",
              "updateAction": "NEW",
              "price": 10629.4,
              "amount": 1.6,
              "symbol": "BTC/USD"
          },
          {
              "id": "1000000fc7402",
              "updateAction": "NEW",
              "price": 10623.4,
              "amount": 0.99,
              "symbol": "BTC/USD"
          }
      ],
      "offers": [
          {
              "id": "1000000fd0522",
              "updateAction": "NEW",
              "price": 10633.5,
              "amount": 1.6,
              "symbol": "BTC/USD"
          },
          {
              "id": "1000000fd05b7",
              "updateAction": "NEW",
              "price": 10637,
              "amount": 1.6,
              "symbol": "BTC/USD"
          },
          {
              "id": "1000000fc7403",
              "updateAction": "NEW",
              "price": 10638.4,
              "amount": 0.99,
              "symbol": "BTC/USD"
          }
      ],
      "transactTime": "20201007-17:37:40.587917127",
      "endFlag": null
    }
   */
    protected _constructLevel3Snapshot(msg, market) {
        const timestampMs = moment.utc(msg.transactTime, "YYYYMMDD-hh:mm:ss.SSSSSSSSS").valueOf();
        const asks = msg.offers.map(
            p =>
                new Level3Point(p.id, p.price.toFixed(8), p.amount.toFixed(8), {
                    type: p.updateAction,
                }),
        );
        const bids = msg.bids.map(
            p =>
                new Level3Point(p.id, p.price.toFixed(8), p.amount.toFixed(8), {
                    type: p.updateAction,
                }),
        );
        return new Level3Snapshot({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs,
            asks,
            bids,
        });
    }

    /**
   {
      "correlation": "4",
      "type": "MarketDataIncrementalRefresh",
      "symbol": "BTC/USD",
      "sendingTime": "20201007-17:37:42.931",
      "bids": [
          {
              "id": "1000000fc7402",
              "updateAction": "NEW",
              "price": 10625,
              "amount": 0.99,
              "symbol": "BTC/USD"
          }
      ],
      "offers": [],
      "transactTime": "20201007-17:37:42.930970367",
      "endFlag": "END_OF_EVENT"
    }
   */
    protected _constructLevel3Update(msg, market) {
        const timestampMs = moment.utc(msg.transactTime, "YYYYMMDD-hh:mm:ss.SSSSSSSSS").valueOf();
        const asks = msg.bids.map(
            p =>
                new Level3Point(p.id, p.price.toFixed(8), p.amount.toFixed(8), {
                    type: p.updateAction,
                }),
        );
        const bids = msg.offers.map(
            p =>
                new Level3Point(p.id, p.price.toFixed(8), p.amount.toFixed(8), {
                    type: p.updateAction,
                }),
        );
        return new Level3Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs,
            asks,
            bids,
        });
    }
}
