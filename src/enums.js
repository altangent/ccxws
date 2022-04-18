const MarketObjectTypes = Object.freeze({
  ticker: 1,
  trade: 2,
  level2snapshot: 3,
  level2update: 4,
  level3snapshot: 5,
  level3update: 6,
  candle: 7,
  bookTicker: 8,
});

const CandlePeriod = Object.freeze({
  _1m: "_1m",
  _2m: "_2m",
  _3m: "_3m",
  _5m: "_5m",
  _15m: "_15m",
  _30m: "_30m",
  _1h: "_1h",
  _2h: "_2h",
  _4h: "_4h",
  _6h: "_6h",
  _8h: "_8h",
  _12h: "_12h",
  _1d: "_1d",
  _3d: "_3d",
  _1w: "_1w",
  _2w: "_2w",
  _1M: "_1M",
});

module.exports = {
  MarketObjectTypes,
  CandlePeriod,
};
