const bibox = require("./exchanges/bibox-client");
const binance = require("./exchanges/binance-client");
const binanceje = require("./exchanges/binanceje-client");
const binanceus = require("./exchanges/binanceus-client");
const bitfinex = require("./exchanges/bitfinex-client");
const bitflyer = require("./exchanges/bitflyer-client");
const bitmex = require("./exchanges/bitmex-client");
const bitstamp = require("./exchanges/bitstamp-client");
const bittrex = require("./exchanges/bittrex-client");
const cex = require("./exchanges/cex-client");
const coinbasepro = require("./exchanges/coinbasepro-client");
const coinex = require("./exchanges/coinex-client");
const ethfinex = require("./exchanges/ethfinex-client");
const ftx = require("./exchanges/ftx-client");
const gateio = require("./exchanges/gateio-client");
const gemini = require("./exchanges/gemini-client");
const hitbtc = require("./exchanges/hitbtc-client");
const huobi = require("./exchanges/huobi-client");
const kucoin = require("./exchanges/kucoin-client");
const kraken = require("./exchanges/kraken-client");
const liquid = require("./exchanges/liquid-client");
const okex = require("./exchanges/okex-client");
const poloniex = require("./exchanges/poloniex-client");
const upbit = require("./exchanges/upbit-client");
const zb = require("./exchanges/zb-client");

module.exports = {
  // export all exchanges
  bibox,
  binance,
  binanceje,
  binanceus,
  bitfinex,
  bitflyer,
  bitmex,
  bitstamp,
  bittrex,
  cex,
  coinbasepro,
  coinex,
  ethfinex,
  ftx,
  gateio,
  gemini,
  hitbtc,
  hitbtc2: hitbtc,
  huobi,
  huobipro: huobi,
  kucoin,
  kraken,
  liquid,
  okex,
  okex3: okex,
  poloniex,
  upbit,
  zb,

  // export all legacy exchange names
  Bibox: bibox,
  Binance: binance,
  Bitfinex: bitfinex,
  Bitflyer: bitflyer,
  BitMEX: bitmex,
  Bitstamp: bitstamp,
  Bittrex: bittrex,
  Ethfinex: ethfinex,
  Gateio: gateio,
  Gemini: gemini,
  HitBTC: hitbtc,
  Huobi: huobi,
  Kraken: kraken,
  OKEx: okex,

  Poloniex: poloniex,
  Upbit: upbit,

  // export all types
  Auction: require("./auction"),
  BasicClient: require("./basic-client"),
  BlockTrade: require("./block-trade"),
  Candle: require("./candle"),
  CandlePeriod: require("./enums").CandlePeriod,
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
