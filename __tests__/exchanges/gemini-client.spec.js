const { testClient } = require("../test-runner");
const GeminiClient = require("../../src/exchanges/gemini-client");

testClient({
  clientFactory: () => new GeminiClient(),
  clientName: "GeminiClient",
  exchangeName: "Gemini",
  markets: [
    {
      id: "btcusd",
      base: "BTC",
      quote: "USD",
    },
    {
      id: "ethusd",
      base: "ETH",
      quote: "USD",
    },
    {
      id: "ltcusd",
      base: "LTC",
      quote: "USD",
    },
  ],

  getEventingSocket(client, market) {
    return client._subscriptions.get(market.id).wss;
  },

  testConnectEvents: true,
  testDisconnectEvents: true,
  testReconnectionEvents: true,
  testCloseEvents: true,

  hasTickers: true,
  hasTrades: true,
  hasCandles: false,
  hasLevel2Snapshots: false,
  hasLevel2Updates: true,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  trade: {
    hasTradeId: true,
  },

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
    hasBid: true,
    hasBidVolume: false,
    hasAsk: true,
    hasAskVolume: false,
  },

  l2snapshot: {
    hasTimestampMs: false,
    hasSequenceId: true,
    hasCount: false,
  },

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: true,
    hasSequenceId: true,
    hasCount: false,
  },
});
