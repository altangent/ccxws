import { testClient } from "../TestRunner";
import { BitstampClient } from "../../src/exchanges/BitstampClient";

testClient({
    clientFactory: () => new BitstampClient(),
    clientName: "BitstampClient",
    exchangeName: "Bitstamp",
    markets: [
        {
            id: "btcusd",
            base: "BTC",
            quote: "USD",
        },
    ],

    testConnectEvents: true,
    testDisconnectEvents: true,
    testReconnectionEvents: true,
    testCloseEvents: true,

    hasTickers: false,
    hasTrades: true,
    hasCandles: false,
    hasLevel2Snapshots: true,
    hasLevel2Updates: true,
    hasLevel3Snapshots: false,
    hasLevel3Updates: false,

    trade: {
        hasTradeId: true,
    },

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
