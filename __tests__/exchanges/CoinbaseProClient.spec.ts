import { testClient } from "../TestRunner";
import { CoinbaseProClient } from "../../src/exchanges/CoinbaseProClient";

testClient({
    clientFactory: () => new CoinbaseProClient(),
    clientName: "CoinbasePro",
    exchangeName: "CoinbasePro",
    markets: [
        {
            id: "BTC-USD",
            base: "BTC",
            quote: "USD",
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
        hasBidVolume: false,
        hasAsk: true,
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
        hasTimestampMs: true,
        hasSequenceId: false,
        hasCount: false,
    },

    l3update: {
        hasSnapshot: false,
        hasTimestampMs: true,
        hasSequenceId: true,
        orderIdPattern: /^[-a-f0-9]{36,36}$/,
        done: (spec, result, update) => {
            const point = update.asks[0] || update.bids[0];
            switch (point.meta.type) {
                case "received":
                    result.hasReceived = true;
                    // if (point.meta.order_type === "limit") {
                    //   expect(parseFloat(point.price)).toBeGreaterThan(0);
                    //   expect(parseFloat(point.size)).toBeGreaterThan(0);
                    // }
                    break;
                case "open":
                    result.hasOpen = true;
                    // expect(parseFloat(point.price)).toBeGreaterThan(0);
                    // expect(parseFloat(point.size)).toBeGreaterThan(0);
                    // expect(parseFloat(point.meta.remaining_size)).toBeGreaterThanOrEqual(0);
                    break;
                case "done":
                    result.hasDone = true;
                    // expect(point.meta.reason).toMatch(/filled|canceled/);
                    break;
                case "match":
                    result.hasMatch = true;
                    // expect(parseFloat(point.price)).toBeGreaterThan(0);
                    // expect(parseFloat(point.size)).toBeGreaterThan(0);
                    // expect(point.meta.trade_id).toBeGreaterThan(0);
                    // expect(point.meta.maker_order_id).toMatch(/^[a-f0-9]{32,32}$/);
                    // expect(point.meta.taker_order_id).toMatch(/^[a-f0-9]{32,32}$/);
                    break;
            }
            return result.hasReceived && result.hasOpen && result.hasDone && result.hasMatch;
        },
    },
});
