import { EventEmitter } from "events";
import { Market } from "./Market";

export interface IClient extends EventEmitter {
    hasTickers: boolean;
    hasTrades: boolean;
    hasCandles: boolean;
    hasLevel2Snapshots: boolean;
    hasLevel2Updates: boolean;
    hasLevel3Snapshots: boolean;
    hasLevel3Updates: boolean;

    reconnect(): void;
    close(): void;

    subscribeTicker(market: Market): void;
    unsubscribeTicker(market: Market): Promise<void>;
    subscribeCandles(market: Market): void;
    unsubscribeCandles(market: Market): Promise<void>;
    subscribeTrades(market: Market): void;
    unsubscribeTrades(market: Market): void;
    subscribeLevel2Snapshots(market: Market): void;
    unsubscribeLevel2Snapshots(market: Market): Promise<void>;
    subscribeLevel2Updates(market: Market): void;
    unsubscribeLevel2Updates(market: Market): Promise<void>;
    subscribeLevel3Snapshots(market: Market): void;
    unsubscribeLevel3Snapshots(market: Market): Promise<void>;
    subscribeLevel3Updates(market: Market): void;
    unsubscribeLevel3Updates(market: Market): Promise<void>;
}
