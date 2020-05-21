const { testClient } = require("../test-runner");
const BinanceJeClient = require("../../src/exchanges/binanceje-client");

testClient({
  clientFactory: () => new BinanceJeClient(),
  clientName: "BinanceJeClient",
  exchangeName: "BinanceJe",
  markets: [
    {
      id: "BTCEUR",
      base: "BTC",
      quote: "EUR",
    },
    {
      id: "BTCGBP",
      base: "BTC",
      quote: "GBP",
    },
    {
      id: "ETHGBP",
      base: "ETH",
      quote: "GBP",
    },
    {
      id: "BNBGBP",
      base: "BNB",
      quote: "GBP",
    },
    {
      id: "BNBEUR",
      base: "BNB",
      quote: "EUR",
    },
    {
      id: "LTCEUR",
      base: "LTC",
      quote: "EUR",
    },
    {
      id: "LTCEUR",
      base: "LTC",
      quote: "EUR",
    },
    {
      id: "BCHEUR",
      base: "BCH",
      quote: "EUR",
    },
    {
      id: "BCHGBP",
      base: "BCH",
      quote: "GBP",
    },
    {
      id: "BGBPGBP",
      base: "BGBP",
      quote: "GBP",
    },
  ],

  skip: false,
  unsubWaitMs: 1500,

  testConnectEvents: true,
  testDisconnectEvents: true,
  testReconnectionEvents: true,
  testCloseEvents: true,

  hasTickers: true,
  hasTrades: true,
  hasCandles: true,
  hasLevel2Snapshots: true,
  hasLevel2Updates: true,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  ticker: {
    hasTimestamp: true,
    hasLast: true,
    hasOpen: true,
    hasHigh: true,
    hasLow: true,
    hasVolume: true,
    hasQuoteVolume: true,
    hasChange: true,
    hasChangePercent: true,
    hasBid: true,
    hasBidVolume: true,
    hasAsk: true,
    hasAskVolume: true,
  },

  trade: {
    hasTradeId: true,
  },

  candle: {},

  l2snapshot: {
    hasTimestampMs: false,
    hasSequenceId: true,
    hasCount: false,
  },

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: false,
    hasSequenceId: true,
    hasCount: false,
  },
});
