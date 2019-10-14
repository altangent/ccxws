class Candle {
  constructor(timestampMs, open, high, low, close, volume) {
    this.timestampMs = timestampMs;
    this.open = open;
    this.high = high;
    this.low = low;
    this.close = close;
    this.volume = volume;
  }
}

module.exports = Candle;
