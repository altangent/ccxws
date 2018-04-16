module.exports = {
  binance: new (require("./exchanges/binance-client"))(),
  bitfinex: new (require("./exchanges/bitfinex-client"))(),
  bittrex: new (require("./exchanges/bittrex-client"))(),
  gdax: new (require("./exchanges/gdax-client"))(),
  poloniex: new (require("./exchanges/poloniex-client"))(),
};
