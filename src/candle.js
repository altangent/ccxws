class Candle {
  constructor(unix, open, high, low, close, volume) {
    this.unix = unix;
    this.open = open;
    this.high = high;
    this.low = low;
    this.close = close;
    this.volume = volume;
  }
}

module.exports = Candle;
