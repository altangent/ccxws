export class BlockTrade {
    public exchange: string;
    public quote: string;
    public base: string;
    public tradeId: string;
    public unix: string;
    public price: string;
    public amount: string;

    constructor({ exchange, base, quote, tradeId, unix, price, amount }: Partial<BlockTrade>) {
        this.exchange = exchange;
        this.quote = quote;
        this.base = base;
        this.tradeId = tradeId;
        this.unix = unix;
        this.price = price;
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
