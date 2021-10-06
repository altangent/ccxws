import { testClient } from "../TestRunner";
import { DigifinexClient } from "../../src/exchanges/DigifinexClient";
import * as https from "../../src/Https";

testClient({
    clientFactory: () => new DigifinexClient(),
    clientName: "DigifinexClient",
    exchangeName: "Digifinex",
    markets: [
        {
            id: "btc_usdt",
            base: "BTC",
            quote: "USDT",
        },
        {
            id: "eth_usdt",
            base: "ETH",
            quote: "USDT",
        },
    ],

    async fetchAllMarkets() {
        const res: any = await https.get("https://openapi.digifinex.com/v3/markets");
        return res.data.map(p => ({
            id: p.market,
            base: p.market.split("_")[0],
            quote: p.market.split("_")[1],
        }));
    },

    testConnectEvents: true,
    testDisconnectEvents: true,
    testReconnectionEvents: true,
    testCloseEvents: true,

    testAllMarketsTrades: true,
    testAllMarketsTradesSuccess: 20,

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
        hasAskVolume: true,
        hasBidVolume: true,
    },

    trade: {
        hasTradeId: true,
        tradeIdPattern: /[0-9]+/,
    },

    l2update: {
        hasSnapshot: true,
        hasTimestampMs: false,
        hasSequenceId: false,
        hasCount: false,
    },

    l2snapshot: {
        hasTimestampMs: false,
        hasSequenceId: false,
        hasCount: false,
    },
});
