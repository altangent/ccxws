/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export class L2Point {
    public price: number;
    public size: number;
    public timestamp: number;
    public meta: any;

    constructor(price: number, size: number, timestamp?: number, meta?: any) {
        this.price = price;
        this.size = size;
        this.timestamp = timestamp;
        this.meta = meta;
    }
}
