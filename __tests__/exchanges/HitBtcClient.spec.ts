import { testClient } from "../TestRunner";
import { HitBtcClient } from "../../src/exchanges/HitBtcClient";
import { get } from "../../src/Https";

testClient({
    clientFactory: () => new HitBtcClient(),
    clientName: "HitBTCClient",
    exchangeName: "HitBTC",
    markets: [
        {
            id: "ETHBTC",
            base: "ETH",
            quote: "BTC",
        },
        {
            id: "BTCUSDT",
            base: "BTC",
            quote: "USDT",
        },
    ],

    fetchAllMarkets: async () => {
        const results: any = await get("https://api.hitbtc.com/api/2/public/symbol");
        return results.map(p => ({ id: p.id, base: p.baseCurrency, quote: p.quoteCurrency }));
    },

    testAllMarketsTrades: true,
    testAllMarketsTradesSuccess: 50,

    testConnectEvents: true,
    testDisconnectEvents: true,
    testReconnectionEvents: true,
    testCloseEvents: true,

    hasTickers: true,
    hasTrades: true,
    hasCandles: true,
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
        hasAsk: true,
        hasBid: true,
        hasAskVolume: false,
        hasBidVolume: false,
    },

    trade: {
        hasTradeId: true,
    },

    candle: {},

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
