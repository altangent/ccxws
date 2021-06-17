import { L2Point } from "./L2Point";
import { L3Point } from "./L3Point";

export class L3PointStore {
    public points: Map<string, L3Point>;

    constructor() {
        this.points = new Map();
    }

    public get(orderId: string): L3Point {
        return this.points.get(orderId);
    }

    public set(point: L3Point) {
        this.points.set(point.orderId, point);
    }

    public delete(orderId: string) {
        this.points.delete(orderId);
    }

    public has(orderId: string): boolean {
        return this.points.has(orderId);
    }

    public clear() {
        this.points.clear();
    }

    public snapshot(depth: number, dir: "asc" | "desc"): L2Point[] {
        let sorter;
        switch (dir) {
            case "asc":
                sorter = sortAsc;
                break;
            case "desc":
                sorter = sortDesc;
                break;
            default:
                throw new Error("Unknown sorter");
        }

        return Array.from(aggByPrice(this.points).values()).sort(sorter).slice(0, depth);
    }
}

function aggByPrice(map: Map<string, L3Point>): Map<number, L2Point> {
    // Aggregate the values into price points
    const aggMap: Map<number, L2Point> = new Map();
    for (const point of map.values()) {
        const price = Number(point.price);
        const size = Number(point.size);

        // If we don't have this price point in the aggregate then we create
        // a new price point with empty values.
        if (!aggMap.has(price)) {
            aggMap.set(price, new L2Point(price, 0, 0));
        }

        // Obtain the price point from the aggregation
        const aggPoint = aggMap.get(price);

        // Update the size
        aggPoint.size += size;
    }

    return aggMap;
}

function sortAsc(a: L3Point, b: L3Point) {
    return a.price - b.price;
}

function sortDesc(a: L3Point, b: L3Point) {
    return b.price - a.price;
}
