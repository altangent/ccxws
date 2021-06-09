/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { EventEmitter } from "events";
import semaphore from "semaphore";
import { Market } from "./Market";
import { IClient } from "./IClient";
import { SubscriptionType } from "./SubscriptionType";
import { wait } from "./Util";
import { NotImplementedFn } from "./NotImplementedFn";

export abstract class BasicMultiClient extends EventEmitter {
    public name: string;
    public hasTickers: boolean;
    public hasTrades: boolean;
    public hasCandles: boolean;
    public hasLevel2Snapshots: boolean;
    public hasLevel2Updates: boolean;
    public hasLevel3Snapshots: boolean;
    public hasLevel3Updates: boolean;
    public throttleMs: number;
    public sem: semaphore.Semaphore;
    public auth: any;

    protected _clients: Map<string, Promise<IClient>>;

    constructor() {
        super();
        this._clients = new Map();

        this.hasTickers = false;
        this.hasTrades = false;
        this.hasCandles = false;
        this.hasLevel2Snapshots = false;
        this.hasLevel2Updates = false;
        this.hasLevel3Snapshots = false;
        this.hasLevel3Updates = false;
        this.throttleMs = 250;
        this.sem = semaphore(3); // this can be overriden to allow more or less
    }

    public async reconnect() {
        for (const client of Array.from(this._clients.values())) {
            (await client).reconnect();
            await wait(this.throttleMs); // delay the reconnection throttling
        }
    }

    public async close(): Promise<void> {
        for (const client of Array.from(this._clients.values())) {
            (await client).close();
        }
    }

    ////// ABSTRACT
    protected abstract _createBasicClient(clientArgs: any): IClient;

    ////// PUBLIC

    public subscribeTicker(market: Market) {
        if (!this.hasTickers) return;
        this._subscribe(market, this._clients, SubscriptionType.ticker);
    }

    public async unsubscribeTicker(market: Market) {
        if (!this.hasTickers) return;
        if (this._clients.has(market.id)) {
            const client = await this._clients.get(market.id);
            client.unsubscribeTicker(market);
        }
    }

    public subscribeCandles(market: Market) {
        if (!this.hasCandles) return;
        this._subscribe(market, this._clients, SubscriptionType.candle);
    }

    public async unsubscribeCandles(market: Market) {
        if (!this.hasCandles) return;
        if (this._clients.has(market.id)) {
            const client = await this._clients.get(market.id);
            client.unsubscribeCandles(market);
        }
    }

    public subscribeTrades(market) {
        if (!this.hasTrades) return;
        this._subscribe(market, this._clients, SubscriptionType.trade);
    }

    public async unsubscribeTrades(market: Market) {
        if (!this.hasTrades) return;
        if (this._clients.has(market.id)) {
            const client = await this._clients.get(market.id);
            client.unsubscribeTrades(market);
        }
    }

    public subscribeLevel2Updates(market: Market) {
        if (!this.hasLevel2Updates) return;
        this._subscribe(market, this._clients, SubscriptionType.level2update);
    }

    public async unsubscribeLevel2Updates(market: Market) {
        if (!this.hasLevel2Updates) return;
        if (this._clients.has(market.id)) {
            const client = await this._clients.get(market.id);
            client.unsubscribeLevel2Updates(market);
        }
    }

    public subscribeLevel2Snapshots(market: Market) {
        if (!this.hasLevel2Snapshots) return;
        this._subscribe(market, this._clients, SubscriptionType.level2snapshot);
    }

    public async unsubscribeLevel2Snapshots(market: Market) {
        if (!this.hasLevel2Snapshots) return;
        if (this._clients.has(market.id)) {
            const client = await this._clients.get(market.id);
            client.unsubscribeLevel2Snapshots(market);
        }
    }

    public subscribeLevel3Snapshots = NotImplementedFn;
    public unsubscribeLevel3Snapshots = NotImplementedFn;
    public subscribeLevel3Updates = NotImplementedFn;
    public unsubscribeLevel3Updates = NotImplementedFn;

    ////// PROTECTED

    protected _createBasicClientThrottled(clientArgs: any) {
        return new Promise(resolve => {
            this.sem.take(() => {
                const client: any = this._createBasicClient(clientArgs);
                client.on("connecting", () => this.emit("connecting", clientArgs.market));
                client.on("connected", () => this.emit("connected", clientArgs.market));
                client.on("disconnected", () => this.emit("disconnected", clientArgs.market));
                client.on("reconnecting", () => this.emit("reconnecting", clientArgs.market));
                client.on("closing", () => this.emit("closing", clientArgs.market));
                client.on("closed", () => this.emit("closed", clientArgs.market));
                client.on("error", err => this.emit("error", err, clientArgs.market));
                const clearSem = async () => {
                    await wait(this.throttleMs);
                    this.sem.leave();
                    resolve(client);
                };
                client.once("connected", clearSem);
                (client as any)._connect();
            });
        });
    }

    protected async _subscribe(
        market: Market,
        map: Map<string, Promise<IClient>>,
        subscriptionType: SubscriptionType,
    ) {
        try {
            const remote_id = market.id;
            let client = null;

            // construct a client
            if (!map.has(remote_id)) {
                const clientArgs = { auth: this.auth, market: market };
                client = this._createBasicClientThrottled(clientArgs);
                // we MUST store the promise in here otherwise we will stack up duplicates
                map.set(remote_id, client);
            }

            // wait for client to be made!
            client = await map.get(remote_id);

            if (subscriptionType === SubscriptionType.ticker) {
                const subscribed = client.subscribeTicker(market);
                if (subscribed) {
                    client.on("ticker", (ticker, market) => {
                        this.emit("ticker", ticker, market);
                    });
                }
            }

            if (subscriptionType === SubscriptionType.candle) {
                const subscribed = client.subscribeCandles(market);
                if (subscribed) {
                    client.on("candle", (candle, market) => {
                        this.emit("candle", candle, market);
                    });
                }
            }

            if (subscriptionType === SubscriptionType.trade) {
                const subscribed = client.subscribeTrades(market);
                if (subscribed) {
                    client.on("trade", (trade, market) => {
                        this.emit("trade", trade, market);
                    });
                }
            }

            if (subscriptionType === SubscriptionType.level2update) {
                const subscribed = client.subscribeLevel2Updates(market);
                if (subscribed) {
                    client.on("l2update", (l2update, market) => {
                        this.emit("l2update", l2update, market);
                    });
                    client.on("l2snapshot", (l2snapshot, market) => {
                        this.emit("l2snapshot", l2snapshot, market);
                    });
                }
            }

            if (subscriptionType === SubscriptionType.level2snapshot) {
                const subscribed = client.subscribeLevel2Snapshots(market);
                if (subscribed) {
                    client.on("l2snapshot", (l2snapshot, market) => {
                        this.emit("l2snapshot", l2snapshot, market);
                    });
                }
            }
        } catch (ex) {
            this.emit("error", ex, market);
        }
    }
}
