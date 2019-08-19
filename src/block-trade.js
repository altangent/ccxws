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

  /**
   * @deprecated use Market object (second argument to each event) to determine exchange and trade pair
   */
  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = BlockTrade;
