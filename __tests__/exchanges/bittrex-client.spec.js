const { testClient } = require("../test-runner");
const BittrexClient = require("../../src/exchanges/bittrex-client");

testClient({
  clientFactory: () => new BittrexClient(),
  clientName: "BittrexClient",
  exchangeName: "Bittrex",
  markets: [
    {
      id: "USDT-BTC",
      base: "BTC",
      quote: "USD",
    },
    {
      id: "BTC-ETH",
      base: "ETH",
      quote: "BTC",
    },
    {
      id: "BTC-LTC",
      base: "LTC",
      quote: "BTC",
    },
    {
      id: "BTC-XRP",
      base: "XRP",
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
  hasLevel2Snapshots: false,
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
    hasBidVolume: false,
    hasAsk: true,
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

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: false,
    hasSequenceId: true,
    hasCount: false,
  },
});
