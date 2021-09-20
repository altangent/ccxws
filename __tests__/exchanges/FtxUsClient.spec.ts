import { testClient } from "../TestRunner";
import { FtxUsClient } from "../../src/exchanges/FtxUsClient";
import * as https from "../../src/Https";

testClient({
    clientFactory: () => new FtxUsClient(),
    clientName: "FtxUsClient",
    exchangeName: "FTX US",

    async fetchMarkets() {
        const res: any = await https.get("https://ftx.us/api/markets");
        return res.result.map(p => ({
            id: p.name,
            type: p.type,
            base: p.baseCurrency,
            quote: p.quoteCurrency,
        }));
    },

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
        hasOpen: false,
        hasHigh: false,
        hasLow: false,
        hasVolume: false,
        hasQuoteVolume: false,
        hasChange: false,
        hasChangePercent: false,
        hasAsk: true,
        hasBid: true,
        hasAskVolume: true,
        hasBidVolume: true,
    },

    trade: {
        hasTradeId: true,
        tradeIdPattern: /[0-9]+/,
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
