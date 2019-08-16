const { testClient } = require("../test-runner");
const BiboxClient = require("../../src/exchanges/bibox-client");

testClient({
  clientFactory: () => new BiboxClient(),
  clientName: "BiboxClient",
  exchangeName: "Bibox",
  markets: [
    {
      id: "BTC_USDT",
      base: "BTC",
      quote: "USDT",
    },
    {
      id: "ETH_BTC",
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
  hasLevel2Updates: false,
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
