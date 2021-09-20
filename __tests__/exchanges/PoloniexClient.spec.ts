import { testClient } from "../TestRunner";
import { PoloniexClient } from "../../src/exchanges/PoloniexClient";

testClient({
    clientFactory: () => new PoloniexClient(),
    clientName: "PoloniexClient",
    exchangeName: "Poloniex",
    markets: [
        {
            id: "USDT_BTC",
            base: "BTC",
            quote: "USDT",
        },
        {
            id: "BTC_ETH",
            base: "ETH",
            quote: "BTC",
        },
        {
            id: "USDT_ETH",
            base: "ETH",
            quote: "USDT",
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
        hasAsk: true,
        hasBid: true,
        hasAskVolume: false,
        hasBidVolume: false,
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
