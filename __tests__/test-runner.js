const winston = require("winston");
const sinon = require("sinon");
const { expect } = require("chai");

module.exports = {
  testClient,
};

function testClient(spec) {
  describe(spec.clientName, () => {
    let state = {};
    let sandbox;

    before(() => {
      state.client = new spec.client();
    });

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(winston);
    });

    afterEach(() => {
      sandbox.restore();
    });

    describe("capabilities", () => {
      it(`should ${spec.hasTickers ? "support" : "not support"} tickers`, () => {
        expect(state.client.hasTickers).to.equal(spec.hasTickers);
      });

      it(`should ${spec.hasTrades ? "support" : "not support"} trades`, () => {
        expect(state.client.hasTrades).to.equal(spec.hasTrades);
      });

      it(`should ${spec.hasLevel2Snapshots ? "support" : "not support"} level2 snapshots`, () => {
        expect(state.client.hasLevel2Snapshots).to.equal(spec.hasLevel2Snapshots);
      });

      it(`should ${spec.hasLevel2Updates ? "support" : "not support"} level2 updates`, () => {
        expect(state.client.hasLevel2Updates).to.equal(spec.hasLevel2Updates);
      });

      it(`should ${spec.hasLevel3Snapshots ? "support" : "not support"} level3 snapshots`, () => {
        expect(state.client.hasLevel3Snapshots).to.equal(spec.hasLevel3Snapshots);
      });

      it(`should ${spec.hasLevel3Updates ? "support" : "not support"} level3 updates`, () => {
        expect(state.client.hasLevel3Updates).to.equal(spec.hasLevel3Updates);
      });
    });

    if (spec.hasTickers) {
      testTickers(spec, state);
    }

    if (spec.hasTrades) {
      testTrades(spec, state);
    }

    if (spec.hasLevel2Snapshots) {
      testLevel2Snapshots(spec, state);
    }
  });
}

function testTickers(spec, state) {
  describe("subscribeTicker", () => {
    let result = {};
    let client;

    before(() => {
      client = state.client;
    });

    it("should subscribe and emit a ticker", done => {
      client.subscribeTicker(spec.markets[0]);
      client.on("ticker", (ticker, market) => {
        result.ticker = ticker;
        result.market = market;
        client.removeAllListeners("ticker");
        done();
      });
    }).timeout(10000);

    it("should unsubscribe from tickers", () => {
      client.unsubscribeTicker(spec.markets[0]);
    });

    describe("results", () => {
      it("market should be the subscribing market", () => {
        expect(result.market).to.equal(spec.markets[0]);
      });

      it("ticker.exchange should be the exchange name", () => {
        expect(result.ticker.exchange).to.equal(spec.exchangeName);
      });

      it("ticker.base should match market.base", () => {
        expect(result.ticker.base).to.equal(spec.markets[0].base);
      });

      it("ticker.quote should match market.quote", () => {
        expect(result.ticker.quote).to.equal(spec.markets[0].quote);
      });

      if (spec.ticker.hasTimestamp) {
        testTimestampMs(result, "ticker.timestamp");
      } else {
        testUndefined(result, "ticker.timestamp");
      }

      let numberProps = [
        [spec.ticker.hasLast, "ticker.last"],
        [spec.ticker.hasOpen, "ticker.open"],
        [spec.ticker.hasHigh, "ticker.high"],
        [spec.ticker.hasLow, "ticker.low"],
        [spec.ticker.hasVolume, "ticker.volume"],
        [spec.ticker.hasQuoteVolume, "ticker.quoteVolume"],
        [spec.ticker.hasChange, "ticker.change"],
        [spec.ticker.hasChangePercent, "ticker.changePercent"],
        [spec.ticker.hasBid, "ticker.bid"],
        [spec.ticker.hasBidVolume, "ticker.bidVolume"],
        [spec.ticker.hasAsk, "ticker.ask"],
        [spec.ticker.hasAskVolume, "ticker.askVolume"],
      ];

      for (let [hasSpec, prop] of numberProps) {
        if (hasSpec) {
          testNumberString(result, prop);
        } else {
          testUndefined(result, prop);
        }
      }
    });
  });
}

function testTrades(spec, state) {
  describe("subscribeTrades", () => {
    let result = {};
    let client;

    before(() => {
      client = state.client;
    });

    it("should subscribe and emit a trade", done => {
      client.subscribeTrades(spec.markets[0]);
      client.on("trade", (trade, market) => {
        result.trade = trade;
        result.market = market;
        client.removeAllListeners("trade");
        done();
      });
    }).timeout(60000);

    it("should unsubscribe from trades", () => {
      client.unsubscribeTrades(spec.markets[0]);
    });

    describe("results", () => {
      it("market should be the subscribing market", () => {
        expect(result.market).to.equal(spec.markets[0]);
      });

      it("trade.exchange should be the exchange name", () => {
        expect(result.trade.exchange).to.equal(spec.exchangeName);
      });

      it("trade.base should match market.base", () => {
        expect(result.trade.base).to.equal(spec.markets[0].base);
      });

      it("trade.quote should match market.quote", () => {
        expect(result.trade.quote).to.equal(spec.markets[0].quote);
      });

      if (spec.trade.hasTradeId) {
        testString(result, "trade.tradeId");
      } else {
        testUndefined(result, "trade.tradeId");
      }

      testTimestampMs(result, "trade.unix");

      it("trade.side should be either 'buy' or 'sell'", () => {
        expect(result.trade.side).to.match(/buy|sell/);
      });

      testNumberString(result, "trade.price");
      testNumberString(result, "trade.amount");
    });
  });
}

function testLevel2Snapshots(spec, state) {
  describe("subscribeLevel2Snapshots", () => {
    let result = {};
    let client;

    before(() => {
      client = state.client;
    });

    it("should subscribe and emit a l2snapshot", done => {
      client.subscribeLevel2Snapshots(spec.markets[0]);
      client.on("l2snapshot", (snapshot, market) => {
        result.snapshot = snapshot;
        result.market = market;
        client.removeAllListeners("l2snapshot");
        done();
      });
    }).timeout(60000);

    it("should unsubscribe from l2snapshot", () => {
      client.unsubscribeLevel2Snapshots(spec.markets[0]);
    });

    describe("results", () => {
      it("market should be the subscribing market", () => {
        expect(result.market).to.equal(spec.markets[0]);
      });

      it("snapshot.exchange should be the exchange name", () => {
        expect(result.snapshot.exchange).to.equal(spec.exchangeName);
      });

      it("snapshot.base should match market.base", () => {
        expect(result.snapshot.base).to.equal(spec.markets[0].base);
      });

      it("snapshot.quote should match market.quote", () => {
        expect(result.snapshot.quote).to.equal(spec.markets[0].quote);
      });

      if (spec.level2Snapshot.hasTimestampMs) {
        testTimestampMs(result, "snapshot.timestampMs");
      } else {
        testUndefined(result, "snapshot.timestampMs");
      }

      if (spec.level2Snapshot.hasSequenceId) {
        testString(result, "snapshot.sequenceId");
      } else {
        testUndefined(result, "snapshot.sequenceId");
      }

      it("snapshot.bid/ask.price should be a string", () => {
        let actual = (result.snapshot.bids[0] || result.snapshot.asks[0]).price;
        expect(actual).to.be.a("string");
      });

      it("snapshot.bid/ask.price should parse to a number", () => {
        let actual = (result.snapshot.bids[0] || result.snapshot.asks[0]).price;
        expect(parseFloat(actual)).to.not.be.NaN;
      });

      it("snapshot.bid/ask.size should be a string", () => {
        let actual = (result.snapshot.bids[0] || result.snapshot.asks[0]).size;
        expect(actual).to.be.a("string");
      });

      it("snapshot.bid/ask.size should parse to a number", () => {
        let actual = (result.snapshot.bids[0] || result.snapshot.asks[0]).size;
        expect(parseFloat(actual)).to.not.be.NaN;
      });

      if (spec.level2Snapshot.hasCount) {
        it("snapshot.bid/ask.count should be a string", () => {
          let actual = (result.snapshot.bids[0] || result.snapshot.asks[0]).count;
          expect(actual).to.be.a("string");
        });

        it("snapshot.bid/ask.count should parse to a number", () => {
          let actual = (result.snapshot.bids[0] || result.snapshot.asks[0]).count;
          expect(parseFloat(actual)).to.not.be.NaN;
        });
      } else {
        it("snapshot.bid/ask.count should undefined", () => {
          let actual = (result.snapshot.bids[0] || result.snapshot.asks[0]).count;
          expect(actual).to.be.undefined;
        });
      }
    });
  });
}

//////////////////////////////////////////////////////

function testNumberString(result, prop) {
  it(`${prop} should be a string`, () => {
    let actual = deepValue(result, prop);
    expect(actual).to.be.a("string");
  });

  it(`${prop} should parse to a number`, () => {
    let actual = deepValue(result, prop);
    expect(parseFloat(actual)).to.not.be.NaN;
  });
}

function testUndefined(result, propPath) {
  it(`${propPath} should be undefined`, () => {
    let actual = deepValue(result, propPath);
    expect(actual).to.be.undefined;
  });
}

function testTimestampMs(result, propPath) {
  it(`${propPath} should be a number`, () => {
    let actual = deepValue(result, propPath);
    expect(actual).to.be.a("number");
  });

  it(`${propPath} should be in milliseconds`, () => {
    let actual = deepValue(result, propPath);
    expect(actual).to.be.greaterThan(1531677480000);
  });
}

function testString(result, propPath) {
  it(`${propPath} should be a string`, () => {
    let actual = deepValue(result, propPath);
    expect(actual).to.be.a("string");
  });

  it(`${propPath} should not be empty`, () => {
    let actual = deepValue(result, propPath);
    expect(actual).to.not.equal("");
  });
}

function deepValue(obj, path) {
  let parts = path.split(".");
  let result = obj;
  for (let part of parts) {
    result = result[part];
  }
  return result;
}
