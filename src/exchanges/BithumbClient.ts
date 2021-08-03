/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import moment from "moment";
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import { debounce } from "../flowcontrol/Debounce";
import { CancelableFn } from "../flowcontrol/Fn";
import { throttle } from "../flowcontrol/Throttle";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Level2Update } from "../Level2Update";
import { Market } from "../Market";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";
import * as https from "../Https";
import { NotImplementedFn } from "../NotImplementedFn";

export class BithumbClient extends BasicClient {
    public remoteIdMap: Map<string, string>;
    public restThrottleMs: number;

    protected _restL2SnapshotPath: string;
    protected _requestLevel2Snapshot: CancelableFn;

    protected _sendSubTicker = NotImplementedFn;
    protected _sendSubCandles = NotImplementedFn;
    protected _sendUnsubCandles = NotImplementedFn;
    protected _sendSubTrades = NotImplementedFn;
    protected _sendSubLevel2Snapshots = NotImplementedFn;
    protected _sendUnsubLevel2Snapshots = NotImplementedFn;
    protected _sendSubLevel2Updates = NotImplementedFn;
    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    constructor({ wssPath = "wss://pubwss.bithumb.com/pub/ws", watcherMs }: ClientOptions = {}) {
        super(wssPath, "Bithumb", undefined, watcherMs);
        this._restL2SnapshotPath = "https://api.bithumb.com/public/orderbook";
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasLevel2Updates = true;
        this.remoteIdMap = new Map();

        this.restThrottleMs = 50;

        this._requestLevel2Snapshot = throttle(this.__requestLevel2Snapshot.bind(this), this.restThrottleMs); // prettier-ignore
        this._sendSubTicker = debounce(this.__sendSubTicker.bind(this));
        this._sendSubTrades = debounce(this.__sendSubTrades.bind(this));
        this._sendSubLevel2Updates = debounce(this.__sendSubLevel2Updates.bind(this));
    }

    protected __sendSubTicker() {
        const symbols = Array.from(this._tickerSubs.keys());
        this._wss.send(
            JSON.stringify({
                type: "ticker",
                symbols,
                tickTypes: ["24H"],
            }),
        );
    }

    protected _sendUnsubTicker() {
        //
    }

    protected __sendSubTrades() {
        const symbols = Array.from(this._tradeSubs.keys());
        this._wss.send(
            JSON.stringify({
                type: "transaction",
                symbols,
            }),
        );
    }

    protected _sendUnsubTrades() {
        //
    }

    protected __sendSubLevel2Updates() {
        const symbols = Array.from(this._level2UpdateSubs.keys());
        for (const symbol of symbols) {
            this._requestLevel2Snapshot(this._level2UpdateSubs.get(symbol));
        }
        this._wss.send(
            JSON.stringify({
                type: "orderbookdepth",
                symbols,
            }),
        );
    }

    protected _sendUnsubLevel2Updates() {
        //
    }

    protected _onMessage(raw: string) {
        const msg = JSON.parse(raw) as any;

        // console.log(raw);

        // tickers
        if (msg.type === "ticker") {
            const remoteId = msg.content.symbol;
            const market = this._tickerSubs.get(remoteId);
            if (!market) return;

            const ticker = this._constructTicker(msg.content, market);
            this.emit("ticker", ticker, market);
            return;
        }

        // trades
        if (msg.type === "transaction") {
            for (const datum of msg.content.list) {
                const remoteId = datum.symbol;
                const market = this._tradeSubs.get(remoteId);
                if (!market) return;

                const trade = this._constructTrade(datum, market);
                this.emit("trade", trade, market);
            }
            return;
        }

        // l2pudate
        if (msg.type === "orderbookdepth") {
            const remoteId = msg.content.list[0].symbol;
            const market = this._level2UpdateSubs.get(remoteId);
            if (!market) return;

            const update = this._constructL2Update(msg, market);
            this.emit("l2update", update, market);
            return;
        }
    }

    /**
    {
      "type":"ticker",
      "content":{
        "tickType":"24H",
        "date":"20200814",
        "time":"063809",
        "openPrice":"13637000",
        "closePrice":"13714000",
        "lowPrice":"13360000",
        "highPrice":"13779000",
        "value":"63252021221.2101",
        "volume":"4647.44384349",
        "sellVolume":"2372.30829641",
        "buyVolume":"2275.03363265",
        "prevClosePrice":"13601000",
        "chgRate":"0.56",
        "chgAmt":"77000",
        "volumePower":"95.89",
        "symbol":"BTC_KRW"
      }
    }
   */
    protected _constructTicker(data: any, market: Market) {
        const timestamp = moment
            .parseZone(data.date + data.time + "+09:00", "YYYYMMDDhhmmssZ")
            .valueOf();
        return new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp,
            last: data.closePrice,
            open: data.openPrice,
            high: data.highPrice,
            low: data.lowPrice,
            volume: data.volume,
            quoteVolume: data.value,
            change: data.chgAmt,
            changePercent: data.chgRate,
        });
    }

    /**
   {
     "type":"transaction",
     "content":
     {
       "list":
       [
         {
          "buySellGb":"1",
          "contPrice":"485900",
          "contQty":"0.196",
          "contAmt":"95236.400",
          "contDtm":"2020-08-14 06:28:41.621909",
          "updn":"dn",
          "symbol":"ETH_KRW"
        },
        {
          "buySellGb":"2",
          "contPrice":"486400",
          "contQty":"5.4277",
          "contAmt":"2640033.2800",
          "contDtm":"2020-08-14 06:28:42.453539",
          "updn":"up",
          "symbol":"ETH_KRW"
        }
      ]
    }
  }
   */
    protected _constructTrade(datum: any, market: Market) {
        const unix = moment
            .parseZone(datum.contDtm + "+09:00", "YYYY-MM-DD hh:mm:ss.SSSSSS")
            .valueOf();
        const side = datum.buySellGb == 1 ? "buy" : "sell";
        const price = datum.contPrice;
        const amount = datum.contQty;
        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            side,
            unix,
            price,
            amount,
        });
    }

    /**
   {
      "type": "orderbookdepth",
      "content": {
        "list": [
          {
            "symbol": "BTC_KRW",
            "orderType": "ask",
            "price": "13811000",
            "quantity": "0",
            "total": "0"
          },
          {
            "symbol": "BTC_KRW",
            "orderType": "ask",
            "price": "13733000",
            "quantity": "0.0213",
            "total": "1"
          },
          {
            "symbol": "BTC_KRW",
            "orderType": "bid",
            "price": "6558000",
            "quantity": "0",
            "total": "0"
          },
          {
            "symbol": "BTC_KRW",
            "orderType": "bid",
            "price": "13728000",
            "quantity": "0.0185",
            "total": "1"
          }
        ],
        "datetime": "1597355189967132"
      }
    }
   */
    protected _constructL2Update(msg, market) {
        const timestampMs = Math.trunc(Number(msg.content.datetime) / 1000);

        const asks = [];
        const bids = [];

        for (const data of msg.content.list) {
            const point = new Level2Point(data.price, data.quantity, data.total);
            if (data.orderType === "bid") bids.push(point);
            else asks.push(point);
        }

        return new Level2Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs,
            asks,
            bids,
            datetime: msg.content.datetime,
        });
    }

    protected async __requestLevel2Snapshot(market: Market) {
        let failed = false;
        try {
            const remote_id = market.id;
            const uri = `${this._restL2SnapshotPath}/${remote_id}`;
            const raw = (await https.get(uri)) as any;
            const timestampMs = Number(raw.data.timestamp);
            const asks = raw.data.asks.map(p => new Level2Point(p.price, p.quantity));
            const bids = raw.data.bids.map(p => new Level2Point(p.price, p.quantity));
            const snapshot = new Level2Snapshot({
                exchange: this.name,
                base: market.base,
                quote: market.quote,
                timestampMs,
                asks,
                bids,
            });
            this.emit("l2snapshot", snapshot, market);
        } catch (ex) {
            this.emit("error", ex);
            failed = true;
        } finally {
            if (failed) this._requestLevel2Snapshot(market);
        }
    }
}
