/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

export class Trade {
    public exchange: string;
    public quote: string;
    public base: string;
    public tradeId: string;
    public sequenceId: number;
    public unix: number;
    public side: string;
    public price: string;
    public amount: string;
    public buyOrderId: string;
    public sellOrderId: string;

    constructor(props: Partial<Trade> | any) {
        this.exchange = props.exchange;
        this.quote = props.quote;
        this.base = props.base;
        this.tradeId = props.tradeId;
        this.sequenceId = props.sequenceId;
        this.unix = props.unix;
        this.side = props.side;
        this.price = props.price;
        this.amount = props.amount;
        this.buyOrderId = props.buyOrderId;
        this.sellOrderId = props.sellOrderId;

        // attach any extra props
        for (const key in props) {
            if (!this[key]) this[key] = props[key];
        }
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
