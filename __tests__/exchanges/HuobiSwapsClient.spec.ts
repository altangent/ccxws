import { HuobiSwapsClient } from "../../src/exchanges/HuobiSwapsClient";
import { testClient } from "../TestRunner";

testClient({
    clientFactory: () => new HuobiSwapsClient(),
    clientName: "HuobiSwapsClient",
    exchangeName: "Huobi Swaps",
    markets: [
        {
            id: "BTC-USD",
            base: "BTC",
            quote: "USD",
        },
        {
            id: "ETH-USD",
            base: "ETH",
            quote: "USD",
        },
    ],

    testConnectEvents: true,
    testDisconnectEvents: true,
    testReconnectionEvents: true,
    testCloseEvents: true,

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
        hasAsk: false,
        hasBid: false,
        hasAskVolume: false,
        hasBidVolume: false,
    },

    trade: {
        hasTradeId: true,
        tradeIdPattern: /[0-9]+/,
    },

    candle: {},

    l2update: {
        hasSnapshot: true,
        hasSequenceId: true,
        hasTimestampMs: true,
    },

    l2snapshot: {
        hasTimestampMs: true,
        hasSequenceId: true,
        hasCount: false,
    },
});
