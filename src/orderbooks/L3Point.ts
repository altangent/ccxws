/**
 * Level 3 order book point
 */
export class L3Point {
    public orderId: string;
    public price: number;
    public size: number;
    public timestamp: number;

    constructor(orderId: string, price: number, size: number, timestamp?: number) {
        this.orderId = orderId;
        this.price = price;
        this.size = size;
        this.timestamp = timestamp;
    }
}
