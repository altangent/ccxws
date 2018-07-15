class Ticker {
  constructor({
    exchange,
    base,
    quote,
    timestamp,
    last,
    dayHigh,
    dayLow,
    dayVolume,
    dayChange,
    dayChangePercent,
    bid,
    bidVolume,
    ask,
    askVolume,
  }) {
    this.exchange = exchange;
    this.base = base;
    this.quote = quote;
    this.timestamp = timestamp;
    this.last = last;
    this.dayHigh = dayHigh;
    this.dayLow = dayLow;
    this.dayVolume = dayVolume;
    this.dayChange = dayChange;
    this.dayChangePercent = dayChangePercent;
    this.bid = bid;
    this.bidVolume = bidVolume;
    this.ask = ask;
    this.askVolume = askVolume;
  }

  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = Ticker;
