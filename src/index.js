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

module.exports = {
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
};
