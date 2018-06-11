class BlockTrade {
  constructor({ exchange, base, quote, tradeId, unix, price, amount }) {
    this.exchange = exchange;
    this.quote = quote;
    this.base = base;
    this.tradeId = tradeId;
    this.unix = unix;
    this.price = price;
    this.amount = amount;
  }

  get marketId() {
    return `${this.base}/${this.quote}`;
  }

  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = BlockTrade;
