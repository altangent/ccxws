const { testClient } = require("../test-runner");
const BitbankClient = require("../../src/exchanges/bitbank-client");

testClient({
  clientFactory: () => new BitbankClient(),
  clientName: "bitbankClient",
  exchangeName: "bitbank",
  markets: [
    {
      id: "btc_jpy",
      base: "BTC",
      quote: "JPY",
    },
    {
      id: "xrp_jpy",
      base: "XRP",
      quote: "JPY",
    },
    {
      id: "xrp_btc",
      base: "XRP",
      quote: "BTC",
    },
    {
      id: "ltc_jpy",
      base: "LTC",
      quote: "JPY",
    },
    {
      id: "ltc_btc",
      base: "LTC",
      quote: "BTC",
    },
    {
      id: "eth_jpy",
      base: "XRP",
      quote: "JPY",
    },
    {
      id: "eth_btc",
      base: "XRP",
      quote: "BTC",
    },
    {
      id: "mona_jpy",
      base: "MONA",
      quote: "JPY",
    },
    {
      id: "mona_btc",
      base: "MONA",
      quote: "BTC",
    },
    {
      id: "bcc_jpy",
      base: "BCC",
      quote: "JPY",
    },
    {
      id: "bcc_btc",
      base: "BCC",
      quote: "BTC",
    },
    {
      id: "xlm_jpy",
      base: "XLM",
      quote: "JPY",
    },
    {
      id: "xlm_btc",
      base: "XLM",
      quote: "BTC",
    },
  ],

  testConnectEvents: false,
  testDisconnectEvents: false,
  testReconnectionEvents: false,
  testCloseEvents: false,

  hasTickers: true,
  hasTrades: true,
  hasCandles: false,
  hasLevel2Snapshots: true,
  hasLevel2Updates: true,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  ticker: {
    hasTimestamp: true,
    hasLast: true,
    hasOpen: false,
    hasHigh: true,
    hasLow: true,
    hasVolume: true,
    hasQuoteVolume: false,
    hasChange: false,
    hasChangePercent: false,
    hasBid: true,
    hasBidVolume: false,
    hasAsk: true,
    hasAskVolume: false,
  },

  trade: {
    hasTradeId: true,
  },

  l2snapshot: {
    hasTimestampMs: true,
    hasSequenceId: false,
    hasCount: false,
  },

  l2update: {
    hasSnapshot: false,
    hasTimestampMs: true,
    hasSequenceId: false,
    hasCount: false,
  },
});
