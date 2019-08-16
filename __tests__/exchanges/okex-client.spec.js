const { testClient } = require("../test-runner");
const OKExClient = require("../../src/exchanges/okex-client");

testClient({
  clientFactory: () => new OKExClient(),
  clientName: "OKExClient",
  exchangeName: "OKEx",
  markets: [
    {
      id: "ETH-BTC",
      base: "ETH",
      quote: "BTC",
    },
  ],

  testConnectEvents: false,
  testDisconnectEvents: false,
  testReconnectionEvents: false,
  testCloseEvents: false,

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
    hasQuoteVolume: false,
    hasChange: true,
    hasChangePercent: true,
    hasAsk: true,
    hasBid: true,
    hasAskVolume: false,
    hasBidVolume: false,
  },

  trade: {
    hasTradeId: true,
  },

  l2snapshot: {
    hasTimestampMs: true,
    hasSequenceId: false,
    hasCount: true,
  },

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: true,
    hasSequenceId: false,
    hasCount: true,
  },
});
