const { testClient } = require("../test-runner");
const BinanceUSClient = require("../../src/exchanges/binanceus-client");

testClient({
  clientFactory: () => new BinanceUSClient(),
  clientName: "BinanceUSClient",
  exchangeName: "BinanceUS",
  markets: [
    {
      id: "BTCUSD",
      base: "BTC",
      quote: "USD",
    },
    {
      id: "ETHUSD",
      base: "ETH",
      quote: "USD",
    },
    {
      id: "XRPUSD",
      base: "XRP",
      quote: "USD",
    },
    {
      id: "BCHUSD",
      base: "BCH",
      quote: "USD",
    },
    {
      id: "LTCUSD",
      base: "LTC",
      quote: "USD",
    },
  ],

  skip: false,

  testConnectEvents: true,
  testDisconnectEvents: true,
  testReconnectionEvents: true,
  testCloseEvents: true,

  hasTickers: true,
  hasTrades: true,
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
