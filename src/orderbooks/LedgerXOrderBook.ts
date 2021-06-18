/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Level3Snapshot } from "../Level3Snapshot";
import { Level3Update } from "../Level3Update";
import { L3Point } from "./L3Point";
import { L3PointStore } from "./L3PointStore";

/**
 * Maintains a Level 3 order book for LedgerX
 */
export class LedgerXOrderBook {
    public asks: L3PointStore;
    public bids: L3PointStore;
    public sequenceId: number;
    public runId: number;

    constructor(snap: Level3Snapshot) {
        this.asks = new L3PointStore();
        this.bids = new L3PointStore();
        this.sequenceId = snap.sequenceId;
        this.runId = 0;

        for (const ask of snap.asks) {
            this.asks.set(new L3Point(ask.orderId, Number(ask.price), Number(ask.size)));
        }

        for (const bid of snap.bids) {
            this.bids.set(new L3Point(bid.orderId, Number(bid.price), Number(bid.size)));
        }
    }

    public reset() {
        this.sequenceId = 0;
        this.asks.clear();
        this.bids.clear();
    }

    public update(update: Level3Update & { runId: number; timestamp: number }) {
        this.sequenceId += 1;

        // Capture the runId of the first update
        if (this.runId === 0) {
            this.runId = update.runId;
        }
        // Handle when the run_id changes and we need to reset things
        else if (update.runId > this.runId) {
            this.reset();
        }

        // Handle if we have odd data for some reason
        if (update.asks.length > 1 || update.bids.length > 1) {
            throw new Error("Malformed update");
        }

        // Extract the update
        const isAsk = update.asks.length > 0;

        const value = isAsk ? update.asks[0] : update.bids[0];
        const map = isAsk ? this.asks : this.bids;

        const orderId = value.orderId;
        const price = Number(value.price);
        const size = Number(value.size);
        const timestamp = (value as any).timestamp;

        // Handle deleting the point
        if (size === 0) {
            map.delete(orderId);
            return;
        }

        // Next try to obtain the point

        // Update existing point
        if (map.has(orderId)) {
            const point = map.get(orderId);
            point.price = price;
            point.size = size;
            point.timestamp = timestamp;
        }

        // Insert the new point
        else {
            map.set(new L3Point(orderId, price, size, timestamp));
        }
    }

    /**
     * Captures a price aggregated snapshot
     * @param {number} depth
     */
    public snapshot(depth = 10) {
        return {
            sequenceId: this.sequenceId,
            runId: this.runId,
            asks: this.asks.snapshot(depth, "asc"),
            bids: this.bids.snapshot(depth, "desc"),
        };
    }
}
