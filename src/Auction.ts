export class Auction {
    public exchange: string;
    public quote: string;
    public base: string;
    public tradeId: string;
    public unix: number;
    public price: string;
    public high: string;
    public low: string;
    public amount: string;

    constructor({
        exchange,
        base,
        quote,
        tradeId,
        unix,
        price,
        amount,
        high,
        low,
    }: Partial<Auction>) {
        this.exchange = exchange;
        this.quote = quote;
        this.base = base;
        this.tradeId = tradeId;
        this.unix = unix;
        this.price = price;
        this.high = high;
        this.low = low;
        this.amount = amount;
    }

    public get marketId() {
        return `${this.base}/${this.quote}`;
    }

    /**
     * @deprecated use Market object (second argument to each event) to determine exchange and trade pair
     */
    public get fullId() {
        return `${this.exchange}:${this.base}/${this.quote}`;
    }
}
