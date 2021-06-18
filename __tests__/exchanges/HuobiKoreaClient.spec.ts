import { HuobiKoreaClient } from "../../src/exchanges/HuobiKoreaClient";
import { testClient } from "../TestRunner";

testClient({
    clientFactory: () => new HuobiKoreaClient(),
    clientName: "HuobiKoreaClient",
    exchangeName: "Huobi Korea",
    markets: [
        {
            id: "btcusdt",
            base: "BTC",
            quote: "USDT",
        },
        {
            id: "ethusdt",
            base: "ETH",
            quote: "USDT",
        },
        {
            id: "ethbtc",
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

    l2snapshot: {
        hasTimestampMs: true,
        hasSequenceId: true,
        hasCount: false,
    },
});
