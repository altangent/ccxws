import { testClient } from "../TestRunner";
import { BinanceFuturesCoinmClient } from "../../src/exchanges/BinanceFuturesCoinmClient";
import { get } from "../../src/Https";

async function fetchAllMarkets() {
    const results = (await get("https://dapi.binance.com/dapi/v1/exchangeInfo")) as any;
    return results.symbols
        .filter(p => p.contractStatus === "TRADING")
        .map(p => ({ id: p.symbol, base: p.baseAsset, quote: p.quoteAsset }));
}

testClient({
    clientFactory: () => new BinanceFuturesCoinmClient(),
    clientName: "BinanceFuturesCoinmClient",
    exchangeName: "Binance Futures COIN-M",

    markets: [],
    allMarkets: [],

    fetchMarkets: fetchAllMarkets,
    fetchAllMarkets: fetchAllMarkets,

    unsubWaitMs: 1500,

    testConnectEvents: true,
    testDisconnectEvents: true,
    testReconnectionEvents: true,
    testCloseEvents: true,

    testAllMarketsTrades: true,
    testAllMarketsTradesSuccess: 5,

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
        hasEventMs: true,
        hasSequenceId: true,
        hasLastSequenceId: true,
        hasCount: false,
    },
});
