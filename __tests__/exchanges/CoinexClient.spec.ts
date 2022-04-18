import { testClient } from "../TestRunner";
import { CoinexClient } from "../../src/exchanges/CoinexClient";

testClient({
    clientFactory: () => new CoinexClient(),
    clientName: "CoinexClient",
    exchangeName: "Coinex",
    markets: [
        {
            id: "BTCUSDT",
            base: "BTC",
            quote: "USDT",
        },
        {
            id: "ETHBTC",
            base: "ETH",
            quote: "BTC",
        },
        {
            id: "ETHUSDT",
            base: "ETH",
            quote: "USDT",
        },
    ],

    getEventingSocket(client: any, market) {
        return client._clients.get(market.id).then(c => c._wss);
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
