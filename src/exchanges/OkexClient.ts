/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-implied-eval */
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
import { Market } from "../Market";
import { NotImplementedFn } from "../NotImplementedFn";
import { Ticker } from "../Ticker";
import { Trade } from "../Trade";

export type OkexClientOptions = ClientOptions & {
    sendThrottleMs?: number;
};

/**
 * Implements OKEx V5 WebSocket API as defined in
 * https://www.okx.com/docs/en/#websocket-api
 *
 * Limits:
 *    1 connection / second
 *    240 subscriptions / hour
 *
 * Connection will disconnect after 30 seconds of silence
 * it is recommended to send a ping message that contains the
 * message "ping".
 *
 * Order book depth includes maintenance of a checksum for the
 * first 25 values in the orderbook. Each update includes a crc32
 * checksum that can be run to validate that your order book
 * matches the server. If the order book does not match you should
 * issue a reconnect.
 *
 * Refer to: https://www.okx.com/docs/en/#websocket-api-checksum
 */
export class OkexClient extends BasicClient {
    public candlePeriod: CandlePeriod;

    protected _sendMessage: CancelableFn;
    protected _pingInterval: NodeJS.Timeout;

    constructor({
        wssPath = "wss://ws.okx.com:8443/ws/v5/public",
        watcherMs,
        sendThrottleMs = 20,
    }: OkexClientOptions = {}) {
        super(wssPath, "OKEx", undefined, watcherMs);
        this.candlePeriod = CandlePeriod._1m;
        this.hasTickers = true;
        this.hasTrades = true;
        this.hasCandles = true;
        this.hasLevel2Snapshots = true;
        this.hasLevel2Updates = true;
        this._sendMessage = throttle(this.__sendMessage.bind(this), sendThrottleMs);
    }

    protected _beforeClose() {
        this._sendMessage.cancel();
    }

    protected _beforeConnect() {
        this._wss.on("connected", this._startPing.bind(this));
        this._wss.on("disconnected", this._stopPing.bind(this));
        this._wss.on("closed", this._stopPing.bind(this));
    }

    protected _startPing() {
        clearInterval(this._pingInterval);
        this._pingInterval = setInterval(this._sendPing.bind(this), 15000);
    }

    protected _stopPing() {
        clearInterval(this._pingInterval);
    }

    protected _sendPing() {
        if (this._wss) {
            this._wss.send("ping");
        }
    }

    /**
     * Constructs a market argument in a backwards compatible manner where
     * the default is a spot market.
     */
    protected _marketArg(method: string, market: Market) {
        const type: string = (market.type || "SPOT").toUpperCase();
        return { channel: method, instId: market.id, instType: type };
    }

    /**
     * Gets the exchanges interpretation of the candle period
     */
    protected _candlePeriod(period: CandlePeriod) {
        switch (period) {
            case CandlePeriod._1m:
                return "1m";
            case CandlePeriod._3m:
                return "3m";
            case CandlePeriod._5m:
                return "5m";
            case CandlePeriod._15m:
                return "15m";
            case CandlePeriod._30m:
                return "30m";
            case CandlePeriod._1h:
                return "1H";
            case CandlePeriod._2h:
                return "2H";
            case CandlePeriod._4h:
                return "4H";
            case CandlePeriod._6h:
                return "6H";
            case CandlePeriod._12h:
                return "12H";
            case CandlePeriod._1d:
                return "1D";
            case CandlePeriod._1w:
                return "1W";
        }
    }

    protected __sendMessage(msg) {
        this._wss.send(msg);
    }

    protected _sendSubTicker(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "subscribe",
                args: [this._marketArg("tickers", market)],
            }),
        );
    }

    protected _sendUnsubTicker(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "unsubscribe",
                args: [this._marketArg("tickers", market)],
            }),
        );
    }

    protected _sendSubTrades(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "subscribe",
                args: [this._marketArg("trades", market)],
            }),
        );
    }

    protected _sendUnsubTrades(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "unsubscribe",
                args: [this._marketArg("trades", market)],
            }),
        );
    }

    protected _sendSubCandles(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "subscribe",
                args: [this._marketArg("candle" + this._candlePeriod(this.candlePeriod), market)],
            }),
        );
    }

    protected _sendUnsubCandles(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "unsubscribe",
                args: [this._marketArg("candle" + this._candlePeriod(this.candlePeriod), market)],
            }),
        );
    }

    protected _sendSubLevel2Snapshots(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "subscribe",
                args: [this._marketArg("books5", market)],
            }),
        );
    }

    protected _sendUnsubLevel2Snapshots(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "unsubscribe",
                args: [this._marketArg("books5", market)],
            }),
        );
    }

    protected _sendSubLevel2Updates(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "subscribe",
                args: [this._marketArg("books-l2-tbt", market)],
            }),
        );
    }

    protected _sendUnsubLevel2Updates(remote_id, market) {
        this._sendMessage(
            JSON.stringify({
                op: "unsubscribe",
                args: [this._marketArg("books-l2-tbt", market)],
            }),
        );
    }

    protected _sendSubLevel3Snapshots = NotImplementedFn;
    protected _sendUnsubLevel3Snapshots = NotImplementedFn;
    protected _sendSubLevel3Updates = NotImplementedFn;
    protected _sendUnsubLevel3Updates = NotImplementedFn;

    protected _onMessage(json: string) {
        // ignore pongs
        if (json === "pong") {
            return;
        }

        // process JSON message
        try {
            const msg = JSON.parse(json.toString());
            this._processsMessage(msg);
        } catch (ex) {
            this.emit("error", ex);
        }
    }

    protected _processsMessage(msg: any) {
        // clear semaphore on subscription event reply
        if (msg.event === "subscribe") {
            return;
        }

        // ignore unsubscribe
        if (msg.event === "unsubscribe") {
            return;
        }

        // prevent failed messages from
        if (!msg.data) {
            // eslint-disable-next-line no-console
            console.warn("warn: failure response", JSON.stringify(msg));
            return;
        }

        // tickers
        if (msg.arg.channel.match(/tickers/)) {
            this._processTicker(msg);
            return;
        }

        // trades
        if (msg.arg.channel.match(/trades/)) {
            this._processTrades(msg);
            return;
        }

        // candles
        if (msg.arg.channel.match(/candle/)) {
            this._processCandles(msg);
            return;
        }

        // l2 snapshots
        if (msg.arg.channel.match(/books5/)) {
            this._processLevel2Snapshot(msg);
            return;
        }

        // l2 updates
        if (msg.arg.channel.match(/books-l2-tbt/)) {
            this._processLevel2Update(msg);
            return;
        }
    }

    /**
   * Process ticker messages in the format
    {
      arg: { channel: 'tickers', instId: 'BTC-USDT' },
      data: [ 
        {
          instType: 'SPOT',
          instId: 'BTC-USDT',
          last: '40280',
          lastSz: '0.00339105',
          askPx: '40280.1',
          askSz: '0.59279275',
          bidPx: '40280',
          bidSz: '0.26603777',
          open24h: '42580',
          high24h: '42671.8',
          low24h: '39747.8',
          sodUtc0: '40476',
          sodUtc8: '42142.2',
          volCcy24h: '295680931.82106796',
          vol24h: '7236.9089522',
          ts: '1650636858898'
        } 
      ]
    }
   */
    protected _processTicker(msg) {
        // ensure market
        const remoteId = msg.arg.instId;
        const market = this._tickerSubs.get(remoteId);
        if (!market) return;

        for (const datum of msg.data) {
            // construct and emit ticker
            const ticker = this._constructTicker(datum, market);
            this.emit("ticker", ticker, market);
        }
    }

    /**
   * Processes trade messages in the format
    { 
      arg:{ channel: 'trades', instId: 'BTC-USDT' },
      data: [ 
        {
          instId: 'ETH-BTC',
          px: '0.0218',
          side: 'sell',
          sz: '1.1',
          ts: '1630048897897',
          tradeId: '776432498' 
        }
      ] 
    }
   */
    protected _processTrades(msg) {
        // ensure market
        const remoteId = msg.arg.instId;
        const market = this._tradeSubs.get(remoteId);
        if (!market) return;

        for (const datum of msg.data) {
            // construct and emit trade
            const trade = this._constructTrade(datum, market);
            this.emit("trade", trade, market);
        }
    }

    /**
   * Processes a candle message
    {
      arg: { channel: 'candle1m', instId: 'BTC-USDT' },
      data: [
        [
          '1650643500000',
          '39299.9',
          '39329.9',
          '39223.6',
          '39230.3',
          '46.90395862',
          '1841904.25187161'
        ]
      ]
    }
   */
    protected _processCandles(msg) {
        // ensure market
        const remoteId = msg.arg.instId;
        const market = this._candleSubs.get(remoteId);
        if (!market) return;

        for (const datum of msg.data) {
            // construct and emit candle
            const candle = this._constructCandle(datum);
            this.emit("candle", candle, market);
        }
    }

    /**
   * Processes a level 2 snapshot message in the format:
    {
      arg: { channel: 'books5', instId: 'BTC-USDT' },
      data: [
       {
          asks: [
            [ '39629.7', '0.01054105', '0', '3' ],
            [ '39630', '0.003', '0', '1' ],
            [ '39634.7', '0.00272956', '0', '1' ],
            [ '39634.9', '0.32', '0', '1' ],
            [ '39635.5', '0.01', '0', '1' ]
          ],
          bids: [
            [ '39629.6', '7.41993802', '0', '29' ],
            [ '39628.7', '0.01059358', '0', '1' ],
            [ '39628.5', '0.03207637', '0', '1' ],
            [ '39628.4', '4.58225129', '0', '9' ],
            [ '39626.5', '0.1', '0', '1' ]
          ],
          instId: 'BTC-USDT',
          ts: '1650655643181'
        }
      ]
   }
   */
    protected _processLevel2Snapshot(msg) {
        // ensure market
        const remote_id = msg.arg.instId;
        const market = this._level2SnapshotSubs.get(remote_id);
        if (!market) return;

        for (const datum of msg.data) {
            // construct snapshot
            const snapshot = this._constructLevel2Snapshot(datum, market);
            this.emit("l2snapshot", snapshot, market);
        }
    }

    /**
   * Processes a level 2 update message in one of two formats.
   * The first message received is the "snapshot" orderbook and contains
   * 200 records in it.
   *
    { 
      "arg": { "channel": "books", "instId": "BTC-USDT" },
      "action": "snapshot",
      "data": [
        {
          "asks": [
            ["8476.98", "415", "0", "13"],
            ["8477", "7", "0", "2"],
            ["8477.34", "85", "0", "1"],
            ["8477.56", "1", "0", "1"],
            ["8505.84", "8", "0", "1"],
            ["8506.37", "85", "0", "1"],
            ["8506.49", "2", "0", "1"],
            ["8506.96", "100", "0", "2"]
          ],
          "bids": [
            ["8476.97", "256", "0", "12"],
            ["8475.55", "101", "0", "1"],
            ["8475.54", "100", "0", "1"],
            ["8475.3", "1", "0", "1"],
            ["8447.32", "6", "0", "1"],
            ["8447.02", "246", "0", "1"],
            ["8446.83", "24", "0", "1"],
            ["8446", "95", "0", "3"]
          ],
          "ts": "1597026383085",
          "checksum": -855196043
        }
      ]
    }
   *
   * Subsequent calls will include the updates stream for changes to
   * the order book:
   *
     { 
      "arg": { "channel": "books", "instId": "BTC-USDT" },
      "action": "update",
      "data": [
        {
          "asks": [
            ["8476.98", "415", "0", "13"],
            ["8477", "7", "0", "2"],
            ["8477.34", "85", "0", "1"],
            ["8477.56", "1", "0", "1"],
            ["8505.84", "8", "0", "1"],
            ["8506.37", "85", "0", "1"],
            ["8506.49", "2", "0", "1"],
            ["8506.96", "100", "0", "2"]
          ],
          "bids": [
            ["8476.97", "256", "0", "12"],
            ["8475.55", "101", "0", "1"],
            ["8475.54", "100", "0", "1"],
            ["8475.3", "1", "0", "1"],
            ["8447.32", "6", "0", "1"],
            ["8447.02", "246", "0", "1"],
            ["8446.83", "24", "0", "1"],
            ["8446", "95", "0", "3"]
          ],
          "ts": "1597026383085",
          "checksum": -855196043
        }
      ]
    }
   */
    protected _processLevel2Update(msg) {
        // ensure market
        const remote_id = msg.arg.instId;
        const market = this._level2UpdateSubs.get(remote_id);
        if (!market) return;
        const action = msg.action;
        for (const datum of msg.data) {
            // handle updates
            if (action === "snapshot") {
                const snapshot = this._constructLevel2Snapshot(datum, market);
                this.emit("l2snapshot", snapshot, market);
            } else if (action === "update") {
                const update = this._constructLevel2Update(datum, market);
                this.emit("l2update", update, market);
            } else {
                // eslint-disable-next-line no-console
                console.error("Unknown action type", msg);
            }
        }
    }

    /**
   * Constructs a ticker from the datum in the format:
    {
      instType: 'SPOT',
      instId: 'BTC-USDT',
      last: '40280',
      lastSz: '0.00339105',
      askPx: '40280.1',
      askSz: '0.59279275',
      bidPx: '40280',
      bidSz: '0.26603777',
      open24h: '42580',
      high24h: '42671.8',
      low24h: '39747.8',
      sodUtc0: '40476',
      sodUtc8: '42142.2',
      volCcy24h: '295680931.82106796',
      vol24h: '7236.9089522',
      ts: '1650636858898'
    }
   */
    protected _constructTicker(data, market) {
        const { last, bidPx, bidSz, askPx, askSz, open24h, high24h, low24h, vol24h, ts } = data;

        const change = parseFloat(last) - parseFloat(open24h);
        const changePercent = change / parseFloat(open24h);
        const timestamp = moment
            .unix(Math.ceil(ts / 1000))
            .utc()
            .valueOf();
        return new Ticker({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestamp,
            last,
            open: open24h,
            high: high24h,
            low: low24h,
            volume: vol24h,
            change: change.toFixed(8),
            changePercent: changePercent.toFixed(2),
            bid: bidPx || "0",
            bidVolume: bidSz || "0",
            ask: askPx || "0",
            askVolume: askSz || "0",
        });
    }

    /**
   * Constructs a trade from the message datum in format:
    { 
      instId: 'ETH-BTC',
      px: '0.02182',
      side: 'sell',
      sz: '0.94',
      ts: '1630048897897',
      tradeId: '776370532'
    }
    */
    protected _constructTrade(datum, market) {
        const { px, side, sz, ts, tradeId } = datum;
        const unix = moment
            .unix(Math.ceil(ts / 1000))
            .utc()
            .valueOf();

        return new Trade({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            tradeId,
            side,
            unix,
            price: px,
            amount: sz,
        });
    }

    /**
   * Constructs a candle for the market
    [
      '1650643500000',
      '39299.9',
      '39329.9',
      '39223.6',
      '39230.3',
      '46.90395862',
      '1841904.25187161'
    ]
   * @param {*} datum
   */
    protected _constructCandle(datum) {
        const [datetime, open, high, low, close, volume] = datum;
        const ts = moment
            .unix(Math.ceil(datetime / 1000))
            .utc()
            .valueOf();
        return new Candle(ts, open, high, low, close, volume);
    }

    /**
   * Constructs a snapshot message from the datum in a
   * snapshot message data property. Datum in the format:
   *
    {
      asks: [
        [ '39629.7', '0.01054105', '0', '3' ],
        [ '39630', '0.003', '0', '1' ],
        [ '39634.7', '0.00272956', '0', '1' ],
        [ '39634.9', '0.32', '0', '1' ],
        [ '39635.5', '0.01', '0', '1' ]
      ],
      bids: [
        [ '39629.6', '7.41993802', '0', '29' ],
        [ '39628.7', '0.01059358', '0', '1' ],
        [ '39628.5', '0.03207637', '0', '1' ],
        [ '39628.4', '4.58225129', '0', '9' ],
        [ '39626.5', '0.1', '0', '1' ]
      ],
      instId: 'BTC-USDT',
      ts: '1650655643181'
    }
   *
   * The snapshot may also come from an update, in which case we need
   * to include the checksum
   *
    {
      "asks": [
        ["8476.98", "415", "0", "13"],
        ["8477", "7", "0", "2"],
        ["8477.34", "85", "0", "1"],
        ["8477.56", "1", "0", "1"],
        ["8505.84", "8", "0", "1"],
        ["8506.37", "85", "0", "1"],
        ["8506.49", "2", "0", "1"],
        ["8506.96", "100", "0", "2"]
      ],
      "bids": [
        ["8476.97", "256", "0", "12"],
        ["8475.55", "101", "0", "1"],
        ["8475.54", "100", "0", "1"],
        ["8475.3", "1", "0", "1"],
        ["8447.32", "6", "0", "1"],
        ["8447.02", "246", "0", "1"],
        ["8446.83", "24", "0", "1"],
        ["8446", "95", "0", "3"]
      ],
      "ts": "1597026383085",
      "checksum": -855196043
    }
   */
    protected _constructLevel2Snapshot(datum, market) {
        const asks = datum.asks.map(p => new Level2Point(p[0], p[1], p[3]));
        const bids = datum.bids.map(p => new Level2Point(p[0], p[1], p[3]));
        const ts = moment
            .unix(Math.ceil(datum.ts / 1000))
            .utc()
            .valueOf();
        const checksum = datum.checksum;
        return new Level2Snapshot({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs: ts,
            asks,
            bids,
            checksum,
        });
    }

    /**
   * Constructs an update message from the datum in the update
   * stream. Datum is in the format:
    {
      "asks": [
        ["8476.98", "415", "0", "13"],
        ["8477", "7", "0", "2"],
        ["8477.34", "85", "0", "1"],
        ["8477.56", "1", "0", "1"],
        ["8505.84", "8", "0", "1"],
        ["8506.37", "85", "0", "1"],
        ["8506.49", "2", "0", "1"],
        ["8506.96", "100", "0", "2"]
      ],
      "bids": [
        ["8476.97", "256", "0", "12"],
        ["8475.55", "101", "0", "1"],
        ["8475.54", "100", "0", "1"],
        ["8475.3", "1", "0", "1"],
        ["8447.32", "6", "0", "1"],
        ["8447.02", "246", "0", "1"],
        ["8446.83", "24", "0", "1"],
        ["8446", "95", "0", "3"]
      ],
      "ts": "1597026383085",
      "checksum": -855196043
    }
   */
    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
    _constructLevel2Update(datum, market) {
        const asks = datum.asks.map(p => new Level2Point(p[0], p[1], p[3]));
        const bids = datum.bids.map(p => new Level2Point(p[0], p[1], p[3]));
        const ts = moment
            .unix(Math.ceil(datum.ts / 1000))
            .utc()
            .valueOf();
        const checksum = datum.checksum;
        return new Level2Update({
            exchange: this.name,
            base: market.base,
            quote: market.quote,
            timestampMs: ts,
            asks,
            bids,
            checksum,
        });
    }
}
