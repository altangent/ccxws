import { testClient } from "../TestRunner";
import { GateioClient } from "../../src/exchanges/GateioClient";

testClient({
    clientFactory: () => new GateioClient(),
    clientName: "GateioClient",
    exchangeName: "Gateio",
    markets: [
        {
            id: "btc_usdt",
            base: "BTC",
            quote: "USDT",
        },
        {
            id: "eth_btc",
            base: "ETH",
            quote: "BTC",
        },
    ],

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
        hasBid: false,
        hasBidVolume: false,
        hasAsk: false,
        hasAskVolume: false,
    },

    trade: {
        hasTradeId: true,
    },

    l2snapshot: {
        hasTimestampMs: false,
        hasSequenceId: false,
        hasCount: false,
    },

    l2update: {
        hasSnapshot: true,
        hasTimestampMs: false,
        hasSequenceId: false,
        hasCount: false,
    },
});
