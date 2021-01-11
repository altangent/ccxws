const { testClient } = require("../test-runner");
const GMOCoinClient = require("../../src/exchanges/gmocoin-client");

testClient({
  clientFactory: () => new GMOCoinClient(),
  clientName: "GMOCoinClient",
  exchangeName: "GMOCoin",
  markets: [
    {
      id: "BTC",
      base: "BTC",
      quote: "JPY",
    },
    {
      id: "ETH",
      base: "ETH",
      quote: "JPY",
    },
    {
      id: "BCH",
      base: "BCH",
      quote: "JPY",
    },
    {
      id: "LTC",
      base: "LTC",
      quote: "JPY",
    },
    {
      id: "XRP",
      base: "XRP",
      quote: "JPY",
    },
  ],

  testConnectEvents: true,
  testDisconnectEvents: true,
  testReconnectionEvents: true,
  testCloseEvents: true,

  hasTickers: true,
  hasTrades: true,
  hasCandles: false,
  hasLevel2Snapshots: true,
  hasLevel2Updates: false,
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
    hasTradeId: false,
  },

  l2snapshot: {
    hasTimestampMs: true,
    hasSequenceId: false,
    hasCount: false,
  },
});
