export class Ticker {
    public exchange: string;
    public base: string;
    public quote: string;
    public timestamp: number;
    public sequenceId: number;
    public last: string;
    public open: string;
    public high: string;
    public low: string;
    public volume: string;
    public quoteVolume: string;
    public change: string;
    public changePercent: string;
    public bid: string;
    public bidVolume: string;
    public ask: string;
    public askVolume: string;

    constructor({
        exchange,
        base,
        quote,
        timestamp,
        sequenceId,
        last,
        open,
        high,
        low,
        volume,
        quoteVolume,
        change,
        changePercent,
        bid,
        bidVolume,
        ask,
        askVolume,
    }: Partial<Ticker>) {
        this.exchange = exchange;
        this.base = base;
        this.quote = quote;
        this.timestamp = timestamp;
        this.sequenceId = sequenceId;
        this.last = last;
        this.open = open;
        this.high = high;
        this.low = low;
        this.volume = volume;
        this.quoteVolume = quoteVolume;
        this.change = change;
        this.changePercent = changePercent;
        this.bid = bid;
        this.bidVolume = bidVolume;
        this.ask = ask;
        this.askVolume = askVolume;
    }

    /**
     * @deprecated use Market object (second argument to each event) to determine exchange and trade pair
     */
    public get fullId() {
        return `${this.exchange}:${this.base}/${this.quote}`;
    }
}
