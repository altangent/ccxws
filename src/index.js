const binance = require("./exchanges/binance-client");
const bitfinex = require("./exchanges/bitfinex-client");
const bitflyer = require("./exchanges/bitflyer-client");
const bitmex = require("./exchanges/bitmex-client");
const bitstamp = require("./exchanges/bitstamp-client");
const bittrex = require("./exchanges/bittrex-client");
const gdax = require("./exchanges/gdax-client");
const gemini = require("./exchanges/gemini-client");
const hitbtc = require("./exchanges/hitbtc-client");
const huobi = require("./exchanges/huobi-client");
const okex = require("./exchanges/okex-client");
const poloniex = require("./exchanges/poloniex-client");
const zb = require("./exchanges/zb-client");

module.exports = {
  // export all legacy exchange names
  Binance: binance,
  Bitfinex: bitfinex,
  Bitflyer: bitflyer,
  BitMEX: bitmex,
  Bitstamp: bitstamp,
  Bittrex: bittrex,
  GDAX: gdax,
  Gemini: gemini,
  HitBTC: hitbtc,
  Huobi: huobi,
  OKEx: okex,
  Poloniex: poloniex,

  // export all exchanges
  binance,
  bitfinex,
  bitflyer,
  bitmex,
  bitstamp,
  bittrex,
  gdax,
  gemini,
  hitbtc,
  huobi,
  okex,
  poloniex,
  zb,

  // export all types
  Auction: require("./auction"),
  BasicClient: require("./basic-client"),
  BlockTrade: require("./block-trade"),
  Level2Point: require("./level2-point"),
  Level2Snapshot: require("./level2-snapshot"),
  Level2Update: require("./level2-update"),
  Level3Point: require("./level3-point"),
  Level3Snapshot: require("./level3-snapshot"),
  Level3Update: require("./level3-update"),
  SmartWss: require("./smart-wss"),
  Ticker: require("./ticker"),
  Trade: require("./trade"),
  Watcher: require("./watcher"),
};
