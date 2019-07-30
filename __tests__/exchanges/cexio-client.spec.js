const { testClient } = require("../test-runner");
const CexClient = require("../../src/exchanges/cex-client");

testClient({
  clientFactory: () =>
    new CexClient({
      apiKey: process.env.CEX_API_KEY,
      apiSecret: process.env.CEX_API_SECRET,
    }),
  clientName: "CexClient",
  exchangeName: "CEX",
  markets: [
    {
      id: "BTC-USD",
      base: "BTC",
      quote: "USD",
    },
  ],

  hasTickers: true,
  hasTrades: true,
  hasLevel2Snapshots: true,
  hasLevel2Updates: false,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  ticker: {
    hasTimestamp: true,
    hasLast: true,
    hasOpen: true,
    hasHigh: false,
    hasLow: false,
    hasVolume: true,
    hasQuoteVolume: false,
    hasChange: true,
    hasChangePercent: true,
    hasBid: false,
    hasBidVolume: false,
    hasAsk: false,
    hasAskVolume: false,
  },

  trade: {
    hasTradeId: true,
  },

  l2snapshot: {
    hasTimestampMs: false,
    hasSequenceId: true,
    hasCount: false,
  },
});
