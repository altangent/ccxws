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
  // export all legacy exchange names
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

  // export all exchanges
  Bibox: bibox,
  Binance: binance,
  BinanceFuturesCoinM: require("./exchanges/binance-futures-coinm-client"),
  BinanceFuturesUsdtM: require("./exchanges/binance-futures-usdtm-client"),
  BinanceJe: binanceje,
  BinanceUs: binanceus,
  Bitfinex: bitfinex,
  Bitflyer: bitflyer,
  Bithumb: require("./exchanges/bithumb-client"),
  BitMEX: bitmex,
  Bitstamp: bitstamp,
  Bittrex: bittrex,
  Cex: cex,
  CoinbasePro: coinbasepro,
  Coinex: coinex,
  Deribit: require("./exchanges/deribit-client"),
  Digifinex: require("./exchanges/digifinex-client"),
  Ethfinex: ethfinex,
  ErisX: require("./exchanges/erisx-client"),
  Ftx: ftx,
  FtxUs: require("./exchanges/ftx-us-client"),
  Gateio: gateio,
  Gemini: gemini,
  HitBTC: hitbtc,
  Huobi: huobi,
  HuobiFutures: require("./exchanges/huobi-futures-client"),
  HuobiSwaps: require("./exchanges/huobi-swaps-client"),
  HuobiJapan: require("./exchanges/huobi-japan-client"),
  HuobiKorea: require("./exchanges/huobi-korea-client"),
  HuobiRussia: require("./exchanges/huobi-russia-client"),
  Kucoin: kucoin,
  Kraken: kraken,
  LedgerX: require("./exchanges/ledgerx-client"),
  Liquid: liquid,
  OKEx: okex,
  Poloniex: poloniex,
  Upbit: upbit,
  Zb: zb,

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
