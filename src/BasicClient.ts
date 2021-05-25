/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "events";
import { IClient } from "./IClient";
import { SmartWss } from "./SmartWss";
import { Watcher } from "./Watcher";
import { Market } from "./Market";

export type MarketMap = Map<string, Market>;
export type WssFactoryFn = (path: string) => SmartWss;
export type SendFn = (remoteId: string, market: Market) => void;

/**
 * Single websocket connection client with
 * subscribe and unsubscribe methods. It is also an EventEmitter
 * and broadcasts 'trade' events.
 *
 * Anytime the WSS client connects (such as a reconnect)
 * it run the _onConnected method and will resubscribe.
 */
export abstract class BasicClient extends EventEmitter implements IClient {
    public hasTickers: boolean;
    public hasTrades: boolean;
    public hasCandles: boolean;
    public hasLevel2Snapshots: boolean;
    public hasLevel2Updates: boolean;
    public hasLevel3Snapshots: boolean;
    public hasLevel3Updates: boolean;

    protected _wssFactory: WssFactoryFn;
    protected _tickerSubs: MarketMap;
    protected _tradeSubs: MarketMap;
    protected _candleSubs: MarketMap;
    protected _level2SnapshotSubs: MarketMap;
    protected _level2UpdateSubs: MarketMap;
    protected _level3SnapshotSubs: MarketMap;
    protected _level3UpdateSubs: MarketMap;
    protected _wss: SmartWss;
    protected _watcher: Watcher;

    constructor(
        readonly wssPath: string,
        readonly name: string,
        wssFactory?: WssFactoryFn,
        watcherMs?: number,
    ) {
        super();
        this._tickerSubs = new Map();
        this._tradeSubs = new Map();
        this._candleSubs = new Map();
        this._level2SnapshotSubs = new Map();
        this._level2UpdateSubs = new Map();
        this._level3SnapshotSubs = new Map();
        this._level3UpdateSubs = new Map();
        this._wss = undefined;
        this._watcher = new Watcher(this, watcherMs);

        this.hasTickers = false;
        this.hasTrades = true;
        this.hasCandles = false;
        this.hasLevel2Snapshots = false;
        this.hasLevel2Updates = false;
        this.hasLevel3Snapshots = false;
        this.hasLevel3Updates = false;
        this._wssFactory = wssFactory || (path => new SmartWss(path));
    }

    //////////////////////////////////////////////

    public close() {
        if (this._beforeClose) {
            this._beforeClose();
        }
        this._watcher.stop();
        if (this._wss) {
            this._wss.close();
            this._wss = undefined;
        }
    }

    public reconnect() {
        this.emit("reconnecting");
        if (this._wss) {
            this._wss.once("closed", () => this._connect());
            this.close();
        } else {
            this._connect();
        }
    }

    public subscribeTicker(market: Market) {
        if (!this.hasTickers) return;
        return this._subscribe(market, this._tickerSubs, this._sendSubTicker.bind(this));
    }

    public unsubscribeTicker(market: Market): Promise<void> {
        if (!this.hasTickers) return;
        this._unsubscribe(market, this._tickerSubs, this._sendUnsubTicker.bind(this));
    }

    public subscribeCandles(market: Market) {
        if (!this.hasCandles) return;
        return this._subscribe(market, this._candleSubs, this._sendSubCandles.bind(this));
    }

    public unsubscribeCandles(market: Market): Promise<void> {
        if (!this.hasCandles) return;
        this._unsubscribe(market, this._candleSubs, this._sendUnsubCandles.bind(this));
    }

    public subscribeTrades(market: Market) {
        if (!this.hasTrades) return;
        return this._subscribe(market, this._tradeSubs, this._sendSubTrades.bind(this));
    }

    public unsubscribeTrades(market: Market): Promise<void> {
        if (!this.hasTrades) return;
        this._unsubscribe(market, this._tradeSubs, this._sendUnsubTrades.bind(this));
    }

    public subscribeLevel2Snapshots(market: Market) {
        if (!this.hasLevel2Snapshots) return;
        return this._subscribe(
            market,
            this._level2SnapshotSubs,
            this._sendSubLevel2Snapshots.bind(this),
        );
    }

    public unsubscribeLevel2Snapshots(market: Market): Promise<void> {
        if (!this.hasLevel2Snapshots) return;
        this._unsubscribe(
            market,
            this._level2SnapshotSubs,
            this._sendUnsubLevel2Snapshots.bind(this),
        );
    }

    public subscribeLevel2Updates(market: Market) {
        if (!this.hasLevel2Updates) return;
        return this._subscribe(
            market,
            this._level2UpdateSubs,
            this._sendSubLevel2Updates.bind(this),
        );
    }

    public unsubscribeLevel2Updates(market: Market): Promise<void> {
        if (!this.hasLevel2Updates) return;
        this._unsubscribe(market, this._level2UpdateSubs, this._sendUnsubLevel2Updates.bind(this));
    }

    public subscribeLevel3Snapshots(market: Market) {
        if (!this.hasLevel3Snapshots) return;
        return this._subscribe(
            market,
            this._level3SnapshotSubs,
            this._sendSubLevel3Snapshots.bind(this),
        );
    }
    public unsubscribeLevel3Snapshots(market: Market): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public subscribeLevel3Updates(market: Market) {
        if (!this.hasLevel3Updates) return;
        return this._subscribe(
            market,
            this._level3UpdateSubs,
            this._sendSubLevel3Updates.bind(this),
        );
    }

    public unsubscribeLevel3Updates(market: Market): Promise<void> {
        if (!this.hasLevel3Updates) return;
        this._unsubscribe(market, this._level3UpdateSubs, this._sendUnsubLevel3Updates.bind(this));
    }

    ////////////////////////////////////////////
    // PROTECTED

    /**
     * Helper function for performing a subscription operation
     * where a subscription map is maintained and the message
     * send operation is performed
     * @param {Market} market
     * @param {Map}} map
     * @param {String} msg
     * @param {Function} sendFn
     * @returns {Boolean} returns true when a new subscription event occurs
     */
    protected _subscribe(market: Market, map: MarketMap, sendFn: SendFn) {
        this._connect();
        const remote_id = market.id;
        if (!map.has(remote_id)) {
            map.set(remote_id, market);

            // perform the subscription if we're connected
            // and if not, then we'll reply on the _onConnected event
            // to send the signal to our server!
            if (this._wss && this._wss.isConnected) {
                sendFn(remote_id, market);
            }
            return true;
        }
        return false;
    }

    /**
     * Helper function for performing an unsubscription operation
     * where a subscription map is maintained and the message
     * send operation is performed
     */
    protected _unsubscribe(market: Market, map: MarketMap, sendFn: SendFn) {
        const remote_id = market.id;
        if (map.has(remote_id)) {
            map.delete(remote_id);

            if (this._wss.isConnected) {
                sendFn(remote_id, market);
            }
        }
    }

    /**
     * Idempotent method for creating and initializing
     * a long standing web socket client. This method
     * is only called in the subscribe method. Multiple calls
     * have no effect.
     */
    protected _connect() {
        if (!this._wss) {
            this._wss = this._wssFactory(this.wssPath);
            this._wss.on("error", this._onError.bind(this));
            this._wss.on("connecting", this._onConnecting.bind(this));
            this._wss.on("connected", this._onConnected.bind(this));
            this._wss.on("disconnected", this._onDisconnected.bind(this));
            this._wss.on("closing", this._onClosing.bind(this));
            this._wss.on("closed", this._onClosed.bind(this));
            this._wss.on("message", (msg: string) => {
                try {
                    this._onMessage(msg);
                } catch (ex) {
                    this._onError(ex);
                }
            });
            this._beforeConnect();

            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this._wss.connect();
        }
    }

    /**
     * Handles the error event
     * @param {Error} err
     */
    protected _onError(err) {
        this.emit("error", err);
    }

    /**
     * Handles the connecting event. This is fired any time the
     * underlying websocket begins a connection.
     */
    protected _onConnecting() {
        this.emit("connecting");
    }

    /**
     * This method is fired anytime the socket is opened, whether
     * the first time, or any subsequent reconnects. This allows
     * the socket to immediate trigger resubscription to relevent
     * feeds
     */
    protected _onConnected() {
        this.emit("connected");
        for (const [marketSymbol, market] of this._tickerSubs) {
            this._sendSubTicker(marketSymbol, market);
        }
        for (const [marketSymbol, market] of this._candleSubs) {
            this._sendSubCandles(marketSymbol, market);
        }
        for (const [marketSymbol, market] of this._tradeSubs) {
            this._sendSubTrades(marketSymbol, market);
        }
        for (const [marketSymbol, market] of this._level2SnapshotSubs) {
            this._sendSubLevel2Snapshots(marketSymbol, market);
        }
        for (const [marketSymbol, market] of this._level2UpdateSubs) {
            this._sendSubLevel2Updates(marketSymbol, market);
        }
        for (const [marketSymbol, market] of this._level3UpdateSubs) {
            this._sendSubLevel3Updates(marketSymbol, market);
        }
        this._watcher.start();
    }

    /**
     * Handles a disconnection event
     */
    protected _onDisconnected() {
        this._watcher.stop();
        this.emit("disconnected");
    }

    /**
     * Handles the closing event
     */
    protected _onClosing() {
        this._watcher.stop();
        this.emit("closing");
    }

    /**
     * Fires before connect
     */
    protected _beforeConnect() {
        //
    }

    /**
     * Fires before close
     */
    protected _beforeClose() {
        //
    }

    /**
     * Handles the closed event
     */
    protected _onClosed() {
        this.emit("closed");
    }

    ////////////////////////////////////////////
    // ABSTRACT

    protected abstract _onMessage(msg: any);

    protected abstract _sendSubTicker(remoteId: string, market: Market);

    protected abstract _sendSubCandles(remoteId: string, market: Market);

    protected abstract _sendUnsubCandles(remoteId: string, market: Market);

    protected abstract _sendUnsubTicker(remoteId: string, market: Market);

    protected abstract _sendSubTrades(remoteId: string, market: Market);

    protected abstract _sendUnsubTrades(remoteId: string, market: Market);

    protected abstract _sendSubLevel2Snapshots(remoteId: string, market: Market);

    protected abstract _sendUnsubLevel2Snapshots(remoteId: string, market: Market);

    protected abstract _sendSubLevel2Updates(remoteId: string, market: Market);

    protected abstract _sendUnsubLevel2Updates(remoteId: string, market: Market);

    protected abstract _sendSubLevel3Snapshots(remoteId: string, market: Market);

    protected abstract _sendUnsubLevel3Snapshots(remoteId: string, market: Market);

    protected abstract _sendSubLevel3Updates(remoteId: string, market: Market);

    protected abstract _sendUnsubLevel3Updates(remoteId: string, market: Market);
}
