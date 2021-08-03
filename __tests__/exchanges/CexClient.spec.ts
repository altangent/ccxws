import { testClient } from "../TestRunner";
import { CexClient } from "../../src/exchanges/CexClient";

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
            id: "BTC/USD",
            base: "BTC",
            quote: "USD",
        },
        {
            id: "BTC/EUR",
            base: "BTC",
            quote: "USD",
        },
        {
            id: "BTT/EUR",
            base: "BTT",
            quote: "EUR",
        },
    ],

    getEventingSocket(client, market) {
        return (client as any)._clients.get(market.id).then(c => c._wss);
    },

    testConnectEvents: true,
    testDisconnectEvents: true,
    testReconnectionEvents: true,
    testCloseEvents: true,

    hasTickers: true,
    hasTrades: true,
    hasCandles: true,
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

    candle: {},

    l2snapshot: {
        hasTimestampMs: false,
        hasSequenceId: true,
        hasCount: false,
    },
});
