const MarketObjectTypes = Object.freeze({
  ticker: 1,
  trade: 2,
  level2snapshot: 3,
  level2update: 4,
  level3snapshot: 5,
  level3update: 6,
  candle: 7,
});

const CandlePeriod = Object.freeze({
  _1m: 60,
  _2m: 120,
  _3m: 180,
  _5m: 300,
  _10m: 600,
  _15m: 900,
  _30m: 1800,
  _1h: 3600,
  _2h: 7200,
  _4h: 14400,
  _6h: 21600,
  _8h: 28800,
  _12h: 43200,
  _1d: 86400,
  _3d: 259200,
  _1w: 604800,
  _1M: 2592000,
});

module.exports = {
  MarketObjectTypes,
  CandlePeriod,
};
