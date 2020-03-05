const { testClient } = require("../test-runner");
const FtxClient = require("../../src/exchanges/ftx-client");

testClient({
  clientFactory: () => new FtxClient(),
  clientName: "FtxClient",
  exchangeName: "FTX",
  markets: [
    {
      id: "BTC/USD",
      base: "BTC",
      quote: "USD",
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
  hasLevel2Updates: true,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  ticker: {
    hasTimestamp: true,
    hasLast: true,
    hasOpen: false,
    hasHigh: false,
    hasLow: false,
    hasVolume: false,
    hasQuoteVolume: false,
    hasChange: false,
    hasChangePercent: false,
    hasAsk: true,
    hasBid: true,
    hasAskVolume: true,
    hasBidVolume: true,
  },

  trade: {
    hasTradeId: true,
    tradeIdPattern: /[0-9]+/,
  },

  l2snapshot: {
    hasTimestampMs: true,
    hasSequenceId: false,
    hasCount: false,
  },
});
