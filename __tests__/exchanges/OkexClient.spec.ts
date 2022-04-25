import { testClient } from "../TestRunner";
import { OkexClient } from "../../src/exchanges/OkexClient";
import { get } from "../../src/Https";

const assertions = {
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
        hasQuoteVolume: false,
        hasChange: true,
        hasChangePercent: true,
        hasAsk: true,
        hasBid: true,
        hasAskVolume: true,
        hasBidVolume: true,
    },

    trade: {
        hasTradeId: true,
    },

    candle: {},

    l2snapshot: {
        hasTimestampMs: true,
        hasSequenceId: false,
        hasCount: true,
        hasChecksum: true,
    },

    l2update: {
        hasSnapshot: true,
        hasTimestampMs: true,
        hasSequenceId: false,
        hasCount: true,
        hasChecksum: true,
    },
};

testClient({
    clientFactory: () => new OkexClient(),
    exchangeName: "OKEx",
    clientName: "OKExClient - Spot",
    markets: [
        {
            id: "BTC-USDT",
            base: "BTC",
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
    clientFactory: () => new OkexClient(),
    exchangeName: "OKEx",
    clientName: "OKExClient - Futures",
    fetchMarkets: async () => {
        const results: any = await get(
            "https://www.okx.com/api/v5/public/instruments?instType=FUTURES",
        );
        return results.data
            .filter(p => p.settleCcy === "BTC")
            .map(p => ({
                id: p.instId,
                base: p.settleCcy,
                quote: p.ctValCcy,
                type: "FUTURES",
            }));
    },
    ...assertions,
});

testClient({
    clientFactory: () => new OkexClient(),
    exchangeName: "OKEx",
    clientName: "OKExClient - Swap",
    fetchMarkets: async () => {
        const results: any = await get(
            "https://www.okx.com/api/v5/public/instruments?instType=SWAP",
        );
        return results.data
            .filter(p => ["BTC", "ETH", "LTC"].includes(p.settleCcy))
            .map(p => ({
                id: p.instId,
                base: p.settleCcy,
                quote: p.ctValCcy,
                type: "SWAP",
            }));
    },
    ...assertions,
});

testClient({
    clientFactory: () => new OkexClient(),
    exchangeName: "OKEx",
    clientName: "OKExClient - Options",
    fetchMarkets: async () => {
        const results: any = await get(
            "https://www.okx.com/api/v5/public/instruments?instType=OPTION&uly=BTC-USD",
        );
        return results.data
            .map(p => ({
                id: p.instId,
                base: p.settleCcy,
                quote: p.ctValCcy,
                type: "OPTION",
            }))
            .filter(p => p.id.endsWith("-C"))
            .slice(0, 20);
    },
    ...assertions,
});
