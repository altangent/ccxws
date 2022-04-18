/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Level3Point } from "../Level3Point";
import { Level3Snapshot } from "../Level3Snapshot";
import { Level3Update } from "../Level3Update";
import { L3Point } from "./L3Point";
import { L3PointStore } from "./L3PointStore";

/**
 * Maintains a Level 3 order book for ErisX
 */
export class ErisXOrderBook {
    public asks: L3PointStore;
    public bids: L3PointStore;
    public timestampMs: number;
    public runId: number;
    public sequenceId: number;

    constructor(snap: Level3Snapshot) {
        this.asks = new L3PointStore();
        this.bids = new L3PointStore();
        this.timestampMs = snap.timestampMs;
        this.runId = 0;

        for (const ask of snap.asks) {
            this.asks.set(new L3Point(ask.orderId, Number(ask.price), Number(ask.size)));
        }

        for (const bid of snap.bids) {
            this.bids.set(new L3Point(bid.orderId, Number(bid.price), Number(bid.size)));
        }
    }

    public update(update: Level3Update) {
        this.timestampMs = update.timestampMs;

        for (const point of update.asks) {
            this.updatePoint(point, false);
        }

        for (const point of update.bids) {
            this.updatePoint(point, false);
        }
    }

    public updatePoint(point: Level3Point, isAsk: boolean) {
        const map = isAsk ? this.asks : this.bids;

        const orderId = point.orderId;
        const price = Number(point.price);
        const size = Number(point.size);
        const type = point.meta.type;

        if (type === "DELETE") {
            map.delete(orderId);
            return;
        } else if (type === "NEW") {
            map.set(new L3Point(orderId, price, size));
        } else {
            throw new Error("Unknown type");
        }
    }

    public snapshot(depth = 10) {
        return {
            sequenceId: this.sequenceId,
            runId: this.runId,
            asks: this.asks.snapshot(depth, "asc"),
            bids: this.bids.snapshot(depth, "desc"),
        };
    }
}
