const { testClient } = require("../test-runner");
const BinanceFuturesUsdtMClient = require("../../src/exchanges/binance-futures-usdtm-client");
const { get } = require("../../src/https");

async function fetchAllMarkets() {
  const results = await get("https://fapi.binance.com/fapi/v1/exchangeInfo");
  return results.symbols
    .filter(p => p.status === "TRADING")
    .map(p => ({ id: p.symbol, base: p.baseAsset, quote: p.quoteAsset }));
}

testClient({
  clientFactory: () => new BinanceFuturesUsdtMClient(),
  clientName: "BinanceFuturesUsdtMClient",
  exchangeName: "Binance Futures USDT-M",
  markets: [
    {
      id: "BTCUSDT",
      base: "BTC",
      quote: "USDT",
    },
    {
      id: "ETHUSDT",
      base: "ETH",
      quote: "USDT",
    },
  ],

  fetchAllMarkets,

  unsubWaitMs: 1500,

  testConnectEvents: true,
  testDisconnectEvents: true,
  testReconnectionEvents: true,
  testCloseEvents: true,

  testAllMarketsTrades: true,
  testAllMarketsTradesSuccess: 20,

  hasTickers: true,
  hasTrades: true,
  hasCandles: true,
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
    hasBid: false, // deviation from spot
    hasBidVolume: false, // deviation from spot
    hasAsk: false, // deviation from spot
    hasAskVolume: false, // deviation from spot
  },

  trade: {
    hasTradeId: true,
  },

  candle: {},

  l2snapshot: {
    hasTimestampMs: true,
    hasSequenceId: true,
    hasCount: false,
  },

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: true,
    hasSequenceId: true,
    hasLastSequenceId: true,
    hasCount: false,
  },
});
