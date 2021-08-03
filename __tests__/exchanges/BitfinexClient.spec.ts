/* eslint-disable @typescript-eslint/no-var-requires */

import { testClient } from "../TestRunner";
import { BitfinexClient } from "../../src/exchanges/BitfinexClient";

testClient({
    clientFactory: () => new BitfinexClient(),
    clientName: "BitfinexClient",
    exchangeName: "Bitfinex",
    markets: [
        {
            id: "BTCUSD",
            base: "BTC",
            quote: "USDT",
        },
        {
            id: "ETHUSD",
            base: "ETH",
            quote: "USD",
        },
        {
            id: "ETHBTC",
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
    hasLevel3Updates: true,

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
        hasBid: true,
        hasBidVolume: true,
        hasAsk: true,
        hasSequenceId: true,
        hasAskVolume: true,
    },

    trade: {
        hasTradeId: true,
        hasSequenceId: true,
    },

    l2snapshot: {
        hasTimestampMs: true,
        hasSequenceId: true,
        hasCount: true,
    },

    l2update: {
        hasSnapshot: true,
        hasTimestampMs: true,
        hasSequenceId: true,
        hasCount: true,
    },

    l3snapshot: {
        hasTimestampMs: true,
        hasSequenceId: true,
    },

    l3update: {
        hasSnapshot: true,
        hasTimestampMs: true,
        hasSequenceId: true,
        hasCount: true,
    },
});
