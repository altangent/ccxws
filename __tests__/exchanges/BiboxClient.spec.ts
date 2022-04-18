import { testClient } from "../TestRunner";
import { BiboxClient } from "../../src/exchanges/BiboxClient";
import * as https from "../../src/Https";

testClient({
    clientFactory: () => new BiboxClient(),
    clientName: "BiboxClient",
    exchangeName: "Bibox",
    markets: [
        {
            id: "BTC_USDT",
            base: "BTC",
            quote: "USDT",
        },
        {
            id: "ETH_USDT",
            base: "ETH",
            quote: "USDT",
        },
        {
            id: "ETH_BTC",
            base: "ETH",
            quote: "BTC",
        },
    ],

    async fetchAllMarkets() {
        const res = (await https.get("https://api.bibox.com/v1/mdata?cmd=pairList")) as any;
        return res.result.map(p => ({
            id: p.pair,
            base: p.pair.split("_")[0],
            quote: p.pair.split("_")[1],
        }));
    },

    getEventingSocket(client) {
        return (client as any)._clients[0]._wss;
    },

    testAllMarketsTrades: true,
    testAllMarketsTradesSuccess: 50,

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
        hasHigh: true,
        hasLow: true,
        hasVolume: true,
        hasQuoteVolume: false,
        hasChange: true,
        hasChangePercent: true,
        hasBid: true,
        hasBidVolume: false,
        hasAsk: true,
        hasAskVolume: false,
    },

    trade: {
        hasTradeId: false,
    },

    candle: {},

    l2snapshot: {
        hasTimestampMs: true,
        hasSequenceId: false,
        hasCount: false,
    },
});
