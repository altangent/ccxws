import { testClient } from "../TestRunner";
import { DeribitClient } from "../../src/exchanges/DeribitClient";
import * as https from "../../src/Https";

const assertions = {
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
        hasOpen: false,
        hasHigh: true,
        hasLow: true,
        hasVolume: true,
        hasQuoteVolume: false,
        hasChange: false,
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
        hasSequenceId: true,
        hasCount: false,
    },

    l2update: {
        hasSnapshot: true,
        hasSequenceId: true,
        hasTimestampMs: true,
    },
};

testClient({
    clientFactory: () => new DeribitClient(),
    clientName: "DeribitClient - Swaps",
    exchangeName: "Deribit",
    markets: [
        {
            id: "BTC-PERPETUAL",
            base: "BTC",
            quote: "USD",
        },
    ],

    testConnectEvents: true,
    testDisconnectEvents: true,
    testReconnectionEvents: true,
    testCloseEvents: true,

    ...assertions,
});

testClient({
    clientFactory: () => new DeribitClient(),
    clientName: "DeribitClient - Futures",
    exchangeName: "Deribit",

    async fetchMarkets() {
        const res: any = await https.get(
            "https://www.deribit.com/api/v2/public/get_instruments?currency=BTC&expired=false&kind=future",
        );
        return res.result.map(p => ({
            id: p.instrument_name,
            base: p.base_currency,
            quote: "USD",
            type: "futures",
        }));
    },

    ...assertions,
});

testClient({
    clientFactory: () => new DeribitClient(),
    clientName: "DeribitClient - Options",
    exchangeName: "Deribit",

    async fetchMarkets() {
        const res: any = await https.get(
            "https://www.deribit.com/api/v2/public/get_instruments?currency=BTC&expired=false&kind=option",
        );
        return res.result
            .map(p => ({
                id: p.instrument_name,
                base: p.base_currency,
                quote: "USD",
                type: "option",
            }))
            .slice(0, 10);
    },

    async fetchTradeMarkets() {
        const res: any = await https.get(
            "https://www.deribit.com/api/v2/public/get_instruments?currency=BTC&expired=false&kind=option",
        );
        return res.result.map(p => ({
            id: p.instrument_name,
            base: p.base_currency,
            quote: "USD",
            type: "option",
        }));
    },

    ...assertions,
});
