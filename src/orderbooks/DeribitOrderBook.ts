import { Level2Snapshot } from "../Level2Snapshots";
import { Level2Update } from "../Level2Update";
import { L2Point } from "./L2Point";

export class DeribitOrderBook {
    public sequenceId: number;
    public asks: L2Point[];
    public bids: L2Point[];
    constructor(snapshot: Level2Snapshot) {
        this.sequenceId = snapshot.sequenceId;
        this.asks = snapshot.asks
            .map(p => new L2Point(Number(p.price), Number(p.size), snapshot.timestampMs))
            .sort(sortDesc);

        this.bids = snapshot.bids
            .map(p => new L2Point(Number(p.price), Number(p.size), snapshot.timestampMs))
            .sort(sortAsc);
    }

    public update(update: Level2Update) {
        this.sequenceId = update.sequenceId;

        for (const ask of update.asks) {
            this._updatePoint(false, Number(ask.price), Number(ask.size), update.timestampMs);
        }

        for (const bid of update.bids) {
            this._updatePoint(true, Number(bid.price), Number(bid.size), update.timestampMs);
        }
    }

    protected _updatePoint(bid: boolean, price: number, size: number, timestamp: number) {
        let arr: L2Point[];
        let index: number;

        // The best bids are the highest priced, meaning the tail of array
        // using the best bids would be sorted ascending
        if (bid) {
            arr = this.bids;
            index = findIndexAsc(arr, price);
        }
        // The best asks are the lowest priced, meaning the tail of array
        // with the best asks would be sorted descending
        else {
            arr = this.asks;
            index = findIndexDesc(arr, price);
        }

        // We perform an update when the index of hte current value has
        // the same price as the update we are now processing.
        if (arr[index] && arr[index].price === price) {
            // Remove the value when the size is 0
            if (Number(size) === 0) {
                arr.splice(index, 1);
                return;
            }

            // Otherwise we perform an update by changing the size
            arr[index].size = size;
            arr[index].timestamp = timestamp;
        }

        // Otherwise we are performing an insert, which we will construct
        // a new point. Because we are using splice, which should have a
        // worst case runtime of O(N), we
        // O()
        else if (Number(size) > 0) {
            const point = new L2Point(price, size, timestamp);
            arr.splice(index, 0, point);
        }
    }

    /**
     * Captures a simple snapshot of best asks and bids up to the
     * requested depth.
     */
    public snapshot(depth: number): { sequenceId: number; asks: L2Point[]; bids: L2Point[] } {
        const asks = [];
        for (let i = this.asks.length - 1; i >= this.asks.length - depth; i--) {
            const val = this.asks[i];
            if (val) asks.push(val);
        }
        const bids = [];
        for (let i = this.bids.length - 1; i >= this.bids.length - depth; i--) {
            const val = this.bids[i];
            if (val) bids.push(val);
        }
        return {
            sequenceId: this.sequenceId,
            asks,
            bids,
        };
    }
}

/**
 * Performs a binary search of a sorted array for the insert or update
 * position of the value and operates on a KrakenOrderBookPoint value
 */
function findIndexAsc(arr: L2Point[], key: number, l: number = 0, r: number = arr.length): number {
    const mid = Math.floor((l + r) / 2);
    if (l === r) return mid;
    if (arr[mid] && arr[mid].price === key) return mid;
    if (arr[mid] && arr[mid].price > key) return findIndexAsc(arr, key, l, mid);
    if (arr[mid] && arr[mid].price < key) return findIndexAsc(arr, key, mid + 1, r);
}

/**
 * Performs a binary search of a sorted array for the insert or update
 * position of the value and operates on a KrakenOrderBookPoint value
 */
function findIndexDesc(arr: L2Point[], key: number, l: number = 0, r: number = arr.length): number {
    const mid = Math.floor((l + r) / 2);
    if (l === r) return mid;
    if (arr[mid] && arr[mid].price === key) return mid;
    if (arr[mid] && arr[mid].price < key) return findIndexDesc(arr, key, l, mid);
    if (arr[mid] && arr[mid].price > key) return findIndexDesc(arr, key, mid + 1, r);
}

/**
 * Sorts points from high to low
 */
function sortDesc(a: L2Point, b: L2Point): number {
    if (a.price > b.price) return -1;
    if (a.price < b.price) return 1;
    return 0;
}

/**
 * Sorts points from low to high
 */
function sortAsc(a: L2Point, b: L2Point) {
    if (a.price < b.price) return -1;
    if (a.price > b.price) return 1;
    return 0;
}
