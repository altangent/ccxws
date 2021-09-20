import { testClient } from "../TestRunner";
import { KrakenClient } from "../../src/exchanges/KrakenClient";

testClient({
    clientFactory: () => new KrakenClient(),
    clientName: "KrakenClient",
    exchangeName: "Kraken",
    markets: [
        {
            id: "XXBTZEUR",
            base: "BTC",
            quote: "EUR",
        },
    ],

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
        hasAskVolume: true,
        hasBidVolume: true,
    },

    trade: {
        hasTradeId: true,
        tradeIdPattern: /\d{19,}/,
    },

    candle: {},

    l2snapshot: {
        hasTimestampMs: true,
        hasSequenceId: false,
        hasCount: false,
    },

    l2update: {
        hasSnapshot: true,
        hasTimestampMs: true,
        hasSequenceId: false,
        hasCount: false,
    },
});
