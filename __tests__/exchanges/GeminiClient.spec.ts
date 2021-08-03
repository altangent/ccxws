import { testClient } from "../TestRunner";
import { GeminiClient } from "../../src/exchanges/Geminiclient";

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
        return (client as any)._subscriptions.get(market.id).wss;
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
        hasEventId: true,
        hasCount: false,
    },

    l2update: {
        done: function (spec, result, update) {
            const hasAsks = update.asks && update.asks.length > 0;
            const hasBids = update.bids && update.bids.length > 0;
            return hasAsks || hasBids;
        },
        hasSnapshot: true,
        hasTimestampMs: true,
        hasSequenceId: true,
        hasEventId: true,
        hasCount: false,
    },
});
