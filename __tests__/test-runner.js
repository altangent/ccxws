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

    // This section describes the capabilities of the client and ensures
    // that the client properly indicates its capabilities
    describe("capabilities", () => {
      let capabilities = [
        ["tickers", "hasTickers", "hasTickers"],
        ["trades", "hasTrades", "hasT"],
        ["level2 snapshots", "hasLevel2Snapshots"],
        ["level2 updates", "hasLevel2Updates"],
        ["level3 snapshots", "hasLevel3Snapshots"],
        ["level3 updates", "hasLevel3Updates"],
      ];

      for (let [name, propName] of capabilities) {
        it(`should ${spec[propName] ? "support" : "not support"} ${name}`, () => {
          expect(state.client[propName]).to.equal(spec[propName]);
        });
      }
    });

    if (spec.hasTickers) {
      testSubscribeTicker(spec, state);
    }
  });
}

function testSubscribeTicker(spec, state) {
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
        it("ticker.timestamp should be a number", () => {
          expect(result.ticker.timestamp).to.be.a("number");
        });

        it("ticker.timestamp should be in milliseconds", () => {
          expect(result.ticker.timestamp).to.be.greaterThan(1531677480000);
        });
      }

      if (!spec.ticker.hasTimestamp) {
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

function deepValue(obj, path) {
  let parts = path.split(".");
  let result = obj;
  for (let part of parts) {
    result = result[part];
  }
  return result;
}
