/* eslint-disable @typescript-eslint/no-var-requires */

import { testClient } from "../TestRunner";
import { BitfinexClient } from "../../src/exchanges/BitfinexClient";

const regularSpec = {
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
        done: function(spec, result, update) {
            const hasAsks = update.asks && update.asks.length > 0;
            const hasBids = update.bids && update.bids.length > 0;
            return hasAsks || hasBids;
        }
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
        done: function(spec, result, update) {
            const hasAsks = update.asks && update.asks.length > 0;
            const hasBids = update.bids && update.bids.length > 0;
            return hasAsks || hasBids;
        }
    },
};
// create a copy of the regular spec for another spec when enableEmptyHeartbeatEvents = true
const sequenceIdValidateWithEmptyHeartbeatsSpec = {
    ...JSON.parse(JSON.stringify(regularSpec)),
    markets: [
        {
            // test a very low volume market
            id: 'ENJUSD',
            base: 'ENJ',
            quote: 'USD'
        },
        {
            id: "BTCUSD",
            base: "BTC",
            quote: "USDT",
        }
    ],
    trade: {
        // note: the empty trade event for heartbeat won't have tradeId. but that won't be the first message so TestRunner won't encounter it
        hasTradeId: true, 
        hasSequenceId: true,
    },
};

testClient({
    // run test w/regular default options
    clientFactory: () => new BitfinexClient(),
    ...regularSpec
}, () => {
    testClient({
        // run test w/enableEmptyHeartbeatEvents option (for those who want to validate sequenceIds)
        clientFactory: () => new BitfinexClient({
            enableEmptyHeartbeatEvents: true,
            tradeMessageType: 'all'
        }),
        ...sequenceIdValidateWithEmptyHeartbeatsSpec
    });
});
