/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BasicClient } from "../BasicClient";
import { ClientOptions } from "../ClientOptions";
import { Level2Point } from "../Level2Point";
import { Level2Snapshot } from "../Level2Snapshots";
import { Level2Update } from "../Level2Update";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";
import * as zlib from "../ZlibUtils";

/**
 * Implements the exchange according to API specifications:
 * https://github.com/DigiFinex/api/blob/master/Websocket_API_en.md
 */
export class DigifinexClient extends BasicClient {
    public id: number;

    constructor({ wssPath = "wss://openapi.digifinex.com/ws/v1/", watcherMs }: ClientOptions = {}) {
        super(wssPath, "Digifinex", undefined, watcherMs);
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasLevel2Updates = true;
        this.id = 0;
        this._onMessageInf = this._onMessageInf.bind(this);
    }

    protected _sendSubTicker(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "ticker.subscribe",
                params: [remote_id],
                id: ++this.id,
            }),
        );
    }

    protected _sendUnsubTicker(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "ticker.unsubscribe",
                params: [remote_id],
                id: ++this.id,
            }),
        );
    }

    protected _sendSubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "trades.subscribe",
                params: [remote_id],
                id: ++this.id,
            }),
        );
    }

    protected _sendUnsubTrades(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "trades.unsubscribe",
                params: [remote_id],
                id: ++this.id,
            }),
        );
    }

    protected _sendSubLevel2Updates(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "depth.subscribe",
                params: [remote_id],
                id: ++this.id,
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id) {
        this._wss.send(
            JSON.stringify({
                method: "depth.unsubscribe",
                params: [remote_id],
                id: ++this.id,
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
        zlib.inflate(raw, this._onMessageInf);
    }

    protected _onMessageInf(err, raw) {
        // handle inflate error
        if (err) {
            this.emit("error", err);
            return;
        }

        // handle parse error
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (err) {
            this.emit("error", err, raw);
            return;
        }

        // handle subscription success
        if (msg.result && msg.result.status === "success") {
            return;
        }

        // handle errors
        if (msg.error) {
            this.emit("error", msg.error);
            return;
        }

        // handle ticker
        if (msg.method === "ticker.update") {
            for (const datum of msg.params) {
                const remote_id = datum.symbol;
                const market =
                    this._tickerSubs.get(remote_id.toUpperCase()) ||
                    this._tickerSubs.get(remote_id.toLowerCase());
                if (!market) continue;

                const ticker = this._constructTicker(datum, market);
                this.emit("ticker", ticker, market);
            }
            return;
        }

        // handle trades
        if (msg.method == "trades.update") {
            const remote_id = msg.params[2];
            const market =
                this._tradeSubs.get(remote_id.toUpperCase()) ||
                this._tradeSubs.get(remote_id.toLowerCase());
            if (!market) return;

            // trades arrive newest first
            for (const datum of msg.params[1].reverse()) {
                const trade = this._constructTrade(datum, market);
                this.emit("trade", trade, market);
            }
            return;
        }

        // handle updates
        if (msg.method === "depth.update") {
            const remote_id = msg.params[2];
            const market =
                this._level2UpdateSubs.get(remote_id.toUpperCase()) ||
                this._level2UpdateSubs.get(remote_id.toLowerCase());
            if (!market) return;

            const snapshot = msg.params[0];
            if (snapshot) {
                const snapshot = this._constructL2Snapshot(msg.params[1], market);
                this.emit("l2snapshot", snapshot, market);
            } else {
                const update = this._constructL2Update(msg.params[1], market);
                this.emit("l2update", update, market);
            }
            return;
        }
    }

    /**
   {
    "method": "ticker.update",
    "params": [{
      "symbol": "BTC_USDT",
      "open_24h": "1760",
      "low_24h": "1.00",
      "base_volume_24h": "11.40088557",
      "quote_volume_24h": "29786.30588557",
      "last": "4000",
      "last_qty": "1",
      "best_bid": "3375",
      "best_bid_size": "0.003",
      "best_ask": "4000",
      "best_ask_size": "108.2542",
      "timestamp": 1586762545336
    }],
    "id": null
  }
  */
    protected _constructTicker(data, market) {
        const change = Number(data.last) - Number(data.open_24h);
        const changePercent = (change / Number(data.open_24h)) * 100;
        return new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp: data.timestamp,
            last: data.last,
            open: data.open_24h,
            high: data.high_24h,
            low: data.low_24h,
            volume: data.base_volume_24h,
            quoteVolume: data.quote_volume_24h,
            change: change.toFixed(8),
            changePercent: changePercent.toFixed(2),
            ask: data.best_ask,
            askVolume: data.best_ask_size,
            bid: data.best_bid,
            bidVolume: data.best_bid_size,
        });
    }

    /**
    {
      "method": "trades.update",
      "params":
      [
        true,
        [
          {
            id: 3282939928,
            time: 1597419159,
            amount: '0.1',
            price: '11687.04',
            type: 'sell'
          }
        ],
        "ETH_USDT"
      ],
      "id": null
    }
   */
    protected _constructTrade(datum, market) {
        const { id, time, price, amount, type } = datum;
        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId: id.toString(),
            side: type,
            unix: Math.trunc(time * 1000),
            price,
            amount,
        });
    }

    /**
   {
      "method": "depth.update",
      "params": [
        true,
        {
          "asks": [
            ["11702.01", "0.001"],
            ["11700.24", "0.8716"],
            ["11699.57", "0.1029"]
          ],
          "bids": [
            ["11697.89", "0.2184"],
            ["11697.13", "7.0356"],
            ["11696.79", "0.2149"]
          ]
        },
        "BTC_USDT"
      ],
      "id": null
    }
   */
    protected _constructL2Snapshot(datum, market) {
        const asks = datum.asks.map(p => new Level2Point(p[0], p[1])).reverse();
        const bids = datum.bids.map(p => new Level2Point(p[0], p[1]));
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
      "method": "depth.update",
      "params": [
        false,
        {
          "asks": [
            ["11702.81", "0.001"],
            ["11699.92", "0.008"],
            ["11788.73", "0"],
            ["11787.24", "0"]
          ],
          "bids": [
            ["11642.72", "13.1172"],
            ["11627.05", "2.1258"],
            ["11621.42", "0"],
            ["11620.87", "0"]
          ]
        },
        "BTC_USDT"
      ],
      "id": null
    }
   */
    protected _constructL2Update(datum, market) {
        const asks = datum.asks.map(p => new Level2Point(p[0], p[1]));
        const bids = datum.bids.map(p => new Level2Point(p[0], p[1]));
        return new Level2Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            asks,
            bids,
        });
    }
}
