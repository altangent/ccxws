const { testClient } = require("../test-runner");
const BitflyerClient = require("../../src/exchanges/bitflyer-client");

testClient({
  clientFactory: () => new BitflyerClient(),
  clientName: "BitflyerClient",
  exchangeName: "bitFlyer",
  markets: [
    {
      id: "BTC_JPY",
      base: "BTC",
      quote: "JPY",
    },
  ],

  hasTickers: true,
  hasTrades: true,
  hasLevel2Snapshots: false,
  hasLevel2Updates: true,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  ticker: {
    hasTimestamp: true,
    hasLast: true,
    hasOpen: false,
    hasHigh: false,
    hasLow: false,
    hasVolume: true,
    hasQuoteVolume: true,
    hasChange: false,
    hasChangePercent: false,
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
    hasSequenceId: false,
    hasCount: false,
  },

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: false,
    hasSequenceId: false,
    hasCount: false,
  },
});
