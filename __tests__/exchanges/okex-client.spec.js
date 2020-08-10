const { testClient } = require("../test-runner");
const OKExClient = require("../../src/exchanges/okex-client");
const { get } = require("../../src/https");

async function fetchFuturesMarkets() {
  const results = await get("https://www.okex.com/api/futures/v3/instruments");
  return results
    .filter(p => p.base_currency === "BTC")
    .map(p => ({
      id: p.instrument_id,
      base: p.base_currency,
      quote: p.quote_currency,
      type: "futures",
    }));
}

const assertions = {
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
};

testClient({
  clientFactory: () => new OKExClient(),
  exchangeName: "OKEx",
  clientName: "OKExClient - Spot",
  markets: [
    {
      id: "BTC-USDT",
      baes: "BTC",
      quote: "USDT",
    },
    {
      id: "ETH-BTC",
      base: "ETH",
      quote: "BTC",
    },
  ],

  testConnectEvents: true,
  testDisconnectEvents: true,
  testReconnectionEvents: true,
  testCloseEvents: true,

  ...assertions,
});

testClient({
  clientFactory: () => new OKExClient(),
  exchangeName: "OKEx",
  clientName: "OKExClient - Futures",
  fetchMarkets: fetchFuturesMarkets,
  ...assertions,
});
