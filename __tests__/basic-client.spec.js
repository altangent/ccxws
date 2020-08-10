const { EventEmitter } = require("events");
const { expect } = require("chai");
const sinon = require("sinon");
const BasicClient = require("../src/basic-client");

function buildInstance() {
  let instance = new BasicClient("wss://localhost/test", "test", mockSmartWss);
  instance.hasTickers = true;
  instance.hasTrades = true;
  instance.hasCandles = true;
  instance.hasLevel2Snapshots = true;
  instance.hasLevel2Updates = true;
  instance.hasLevel3Updates = true;
  instance._onMessage = sinon.stub();
  instance._sendSubTicker = sinon.stub();
  instance._sendUnsubTicker = sinon.stub();
  instance._sendSubTrades = sinon.stub();
  instance._sendUnsubTrades = sinon.stub();
  instance._sendSubCandles = sinon.stub();
  instance._sendUnsubCandles = sinon.stub();
  instance._sendSubLevel2Snapshots = sinon.stub();
  instance._sendUnsubLevel2Snapshots = sinon.stub();
  instance._sendSubLevel2Updates = sinon.stub();
  instance._sendUnsubLevel2Updates = sinon.stub();
  instance._sendSubLevel3Updates = sinon.stub();
  instance._sendUnsubLevel3Updates = sinon.stub();

  sinon.stub(instance._watcher, "start");
  sinon.stub(instance._watcher, "stop");
  return instance;
}

function mockSmartWss() {
  let wss = new EventEmitter();
  wss.connect = sinon.stub();
  wss.close = sinon.stub();
  wss.mockEmit = function(event, payload) {
    if (event === "connected") this.isConnected = true;
    this.emit(event, payload);
  };
  wss.isConnected = false;
  wss.close.callsFake(() => {
    wss.mockEmit("closing");
    setTimeout(() => wss.mockEmit("closed"), 0);
  });
  return wss;
}

describe("BasicClient", () => {
  let instance;

  before(() => {
    instance = buildInstance();
    instance._connect();
  });

  describe("on first subscribe", () => {
    it("should open a connection", () => {
      instance.subscribeTrades({ id: "BTCUSD" });
      expect(instance._wss).to.not.be.undefined;
      expect(instance._wss.connect.callCount).to.equal(1);
    });
    it("should send subscribe to the socket", () => {
      instance._wss.mockEmit("connected");
      expect(instance._sendSubTrades.callCount).to.equal(1);
      expect(instance._sendSubTrades.args[0][0]).to.equal("BTCUSD");
      expect(instance._sendSubTrades.args[0][1]).to.be.an("object");
    });
    it("should start the watcher", () => {
      expect(instance._watcher.start.callCount).to.equal(1);
    });
  });

  describe("on subsequent subscribes", () => {
    it("should not connect again", () => {
      instance.subscribeTrades({ id: "LTCBTC" });
      expect(instance._wss.connect.callCount).to.equal(1);
    });
    it("should send subscribe to the socket", () => {
      expect(instance._sendSubTrades.callCount).to.equal(2);
      expect(instance._sendSubTrades.args[1][0]).to.equal("LTCBTC");
      expect(instance._sendSubTrades.args[1][1]).to.be.an("object");
    });
  });

  describe("on duplicate subscribe", () => {
    it("should not send subscribe to the socket", () => {
      instance.subscribeTrades({ id: "LTCBTC" });
      expect(instance._sendSubTrades.callCount).to.equal(2);
    });
  });

  describe("on message", () => {
    before(() => {
      instance._wss.mockEmit("message", "test");
    });
    it("should call on message", () => {
      expect(instance._onMessage.args[0][0]).to.equal("test");
    });
  });

  describe("on reconnect", () => {
    it("should resubscribe to markets", () => {
      instance._wss.mockEmit("connected");
      expect(instance._sendSubTrades.callCount).to.equal(4);
      expect(instance._sendSubTrades.args[2][0]).to.equal("BTCUSD");
      expect(instance._sendSubTrades.args[2][1]).to.be.an("object");
      expect(instance._sendSubTrades.args[3][0]).to.equal("LTCBTC");
      expect(instance._sendSubTrades.args[3][1]).to.be.an("object");
    });
  });

  describe("on unsubscribe", () => {
    it("should send unsubscribe to socket", () => {
      instance.unsubscribeTrades({ id: "LTCBTC" });
      expect(instance._sendUnsubTrades.callCount).to.equal(1);
      expect(instance._sendUnsubTrades.args[0][0]).to.equal("LTCBTC");
      expect(instance._sendUnsubTrades.args[0][1]).to.be.an("object");
    });
  });

  describe("on duplicate unsubscribe", () => {
    it("should not send unsubscribe to the socket", () => {
      instance.unsubscribeTrades({ id: "LTCBTC" });
      expect(instance._sendUnsubTrades.callCount).to.equal(1);
    });
  });

  describe("when no messages received", () => {
    let originalWss;
    let closingEvent = sinon.stub();
    let closedEvent = sinon.stub();
    let reconnectingEvent = sinon.stub();

    before(async () => {
      originalWss = instance._wss;
      instance.on("closing", closingEvent);
      instance.on("closed", closedEvent);
      instance.on("reconnecting", reconnectingEvent);
      instance.emit("trade"); // triggers the connection watcher
      instance._watcher._reconnect();
    });

    it("should close the connection", () => {
      expect(originalWss.close.callCount).to.equal(1);
    });

    it("should emit a closing event", () => {
      expect(closingEvent.callCount).to.equal(1);
    });

    it("should emit a closed event", () => {
      expect(closedEvent.callCount).to.equal(1);
    });

    it("should reopen the connection", () => {
      expect(instance._wss).to.not.deep.equal(originalWss);
      expect(instance._wss.connect.callCount).to.equal(1);
    });

    it("should emit a reconnected event", () => {
      expect(reconnectingEvent.callCount).to.equal(1);
    });
  });

  describe("when connected, on disconnect", () => {
    it("disconnect event should fire if the underlying socket closes", done => {
      instance._watcher.stop.resetHistory();
      instance.on("disconnected", done);
      instance._wss.mockEmit("disconnected");
    });

    it("close should stop the reconnection checker", () => {
      expect(instance._watcher.stop.callCount).to.equal(1);
    });
  });

  describe("when connected, .close", () => {
    it("close should emit 'closing' and 'closed' events", done => {
      instance._watcher.stop.resetHistory();
      let closing = false;
      instance.on("closing", () => {
        closing = true;
      });
      instance.on("closed", () => {
        instance.removeAllListeners();
        if (closing) done();
      });
      instance.close();
    });

    it("close should stop the reconnection checker", () => {
      expect(instance._watcher.stop.callCount).to.equal(2);
    });
  });

  describe("when already closed", () => {
    it("should not 'closing' and 'closed' events", () => {
      instance.on("closing", () => {
        throw new Error("should not reach here");
      });
      instance.on("closed", () => {
        throw new Error("should not reach here");
      });
      instance.close();
    });
  });

  describe("level2 snapshots", () => {
    let instance;

    before(() => {
      instance = buildInstance();
      instance._connect();
    });

    describe("on first subscribe", () => {
      it("should open a connection", () => {
        instance.subscribeLevel2Snapshots({ id: "BTCUSD" });
        expect(instance._wss).to.not.be.undefined;
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        instance._wss.mockEmit("connected");
        expect(instance._sendSubLevel2Snapshots.callCount).to.equal(1);
        expect(instance._sendSubLevel2Snapshots.args[0][0]).to.equal("BTCUSD");
        expect(instance._sendSubLevel2Snapshots.args[0][1]).to.be.an("object");
      });
      it("should start the reconnectChecker", () => {
        expect(instance._watcher.start.callCount).to.equal(1);
      });
    });

    describe("on subsequent subscribes", () => {
      it("should not connect again", () => {
        instance.subscribeLevel2Snapshots({ id: "LTCBTC" });
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        expect(instance._sendSubLevel2Snapshots.callCount).to.equal(2);
        expect(instance._sendSubLevel2Snapshots.args[1][0]).to.equal("LTCBTC");
        expect(instance._sendSubLevel2Snapshots.args[1][1]).to.be.an("object");
      });
    });

    describe("on unsubscribe", () => {
      it("should send unsubscribe to socket", () => {
        instance.unsubscribeLevel2Snapshots({ id: "LTCBTC" });
        expect(instance._sendUnsubLevel2Snapshots.callCount).to.equal(1);
        expect(instance._sendUnsubLevel2Snapshots.args[0][0]).to.equal("LTCBTC");
        expect(instance._sendUnsubLevel2Snapshots.args[0][1]).to.be.an("object");
      });
    });
  });

  describe("level2 updates", () => {
    let instance;

    before(() => {
      instance = buildInstance();
      instance._connect();
    });

    describe("on first subscribe", () => {
      it("should open a connection", () => {
        instance.subscribeLevel2Updates({ id: "BTCUSD" });
        expect(instance._wss).to.not.be.undefined;
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        instance._wss.mockEmit("connected");
        expect(instance._sendSubLevel2Updates.callCount).to.equal(1);
        expect(instance._sendSubLevel2Updates.args[0][0]).to.equal("BTCUSD");
        expect(instance._sendSubLevel2Updates.args[0][1]).to.be.an("object");
      });
      it("should start the reconnectChecker", () => {
        expect(instance._watcher.start.callCount).to.equal(1);
      });
    });

    describe("on subsequent subscribes", () => {
      it("should not connect again", () => {
        instance.subscribeLevel2Updates({ id: "LTCBTC" });
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        expect(instance._sendSubLevel2Updates.callCount).to.equal(2);
        expect(instance._sendSubLevel2Updates.args[1][0]).to.equal("LTCBTC");
        expect(instance._sendSubLevel2Updates.args[1][1]).to.be.an("object");
      });
    });

    describe("on unsubscribe", () => {
      it("should send unsubscribe to socket", () => {
        instance.unsubscribeLevel2Updates({ id: "LTCBTC" });
        expect(instance._sendUnsubLevel2Updates.callCount).to.equal(1);
        expect(instance._sendUnsubLevel2Updates.args[0][0]).to.equal("LTCBTC");
      });
    });
  });

  describe("level3 updates", () => {
    let instance;

    before(() => {
      instance = buildInstance();
      instance._connect();
    });

    describe("on first subscribe", () => {
      it("should open a connection", () => {
        instance.subscribeLevel3Updates({ id: "BTCUSD" });
        expect(instance._wss).to.not.be.undefined;
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        instance._wss.mockEmit("connected");
        expect(instance._sendSubLevel3Updates.callCount).to.equal(1);
        expect(instance._sendSubLevel3Updates.args[0][0]).to.equal("BTCUSD");
        expect(instance._sendSubLevel3Updates.args[0][1]).to.be.an("object");
      });
      it("should start the reconnectChecker", () => {
        expect(instance._watcher.start.callCount).to.equal(1);
      });
    });

    describe("on subsequent subscribes", () => {
      it("should not connect again", () => {
        instance.subscribeLevel3Updates({ id: "LTCBTC" });
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        expect(instance._sendSubLevel3Updates.callCount).to.equal(2);
        expect(instance._sendSubLevel3Updates.args[1][0]).to.equal("LTCBTC");
        expect(instance._sendSubLevel3Updates.args[1][1]).to.be.an("object");
      });
    });

    describe("on unsubscribe", () => {
      it("should send unsubscribe to socket", () => {
        instance.unsubscribeLevel3Updates({ id: "LTCBTC" });
        expect(instance._sendUnsubLevel3Updates.callCount).to.equal(1);
        expect(instance._sendUnsubLevel3Updates.args[0][0]).to.equal("LTCBTC");
      });
    });
  });

  describe("ticker", () => {
    let instance;

    before(() => {
      instance = buildInstance();
      instance._connect();
    });

    describe("on first subscribe", () => {
      it("should open a connection", () => {
        instance.subscribeTicker({ id: "BTCUSD" });
        expect(instance._wss).to.not.be.undefined;
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        instance._wss.mockEmit("connected");
        expect(instance._sendSubTicker.callCount).to.equal(1);
        expect(instance._sendSubTicker.args[0][0]).to.equal("BTCUSD");
        expect(instance._sendSubTicker.args[0][1]).to.be.an("object");
      });
      it("should start the reconnectChecker", () => {
        expect(instance._watcher.start.callCount).to.equal(1);
      });
    });

    describe("on subsequent subscribes", () => {
      it("should not connect again", () => {
        instance.subscribeTicker({ id: "LTCBTC" });
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        expect(instance._sendSubTicker.callCount).to.equal(2);
        expect(instance._sendSubTicker.args[1][0]).to.equal("LTCBTC");
        expect(instance._sendSubTicker.args[1][1]).to.be.an("object");
      });
    });

    // describe("on unsubscribe", () => {
    //   it("should send unsubscribe to socket", () => {
    //     instance.unsubscribeTicker({ id: "LTCBTC" });
    //     expect(instance._sendUnsubTicker.callCount).to.equal(1);
    //     expect(instance._sendUnsubTicker.args[0][0]).to.equal("LTCBTC");
    //   });
    // });
  });

  describe("candle", () => {
    let instance;

    before(() => {
      instance = buildInstance();
      instance._connect();
    });

    describe("on first subscribe", () => {
      it("should open a connection", () => {
        instance.subscribeCandles({ id: "BTCUSD" });
        expect(instance._wss).to.not.be.undefined;
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        instance._wss.mockEmit("connected");
        expect(instance._sendSubCandles.callCount).to.equal(1);
        expect(instance._sendSubCandles.args[0][0]).to.equal("BTCUSD");
        expect(instance._sendSubCandles.args[0][1]).to.be.an("object");
      });
      it("should start the reconnectChecker", () => {
        expect(instance._watcher.start.callCount).to.equal(1);
      });
    });

    describe("on subsequent subscribes", () => {
      it("should not connect again", () => {
        instance.subscribeCandles({ id: "LTCBTC" });
        expect(instance._wss.connect.callCount).to.equal(1);
      });
      it("should send subscribe to the socket", () => {
        expect(instance._sendSubCandles.callCount).to.equal(2);
        expect(instance._sendSubCandles.args[1][0]).to.equal("LTCBTC");
        expect(instance._sendSubCandles.args[1][1]).to.be.an("object");
      });
    });

    describe("on unsubscribe", () => {
      it("should send unsubscribe to socket", () => {
        instance.unsubscribeCandles({ id: "LTCBTC" });
        expect(instance._sendUnsubCandles.callCount).to.equal(1);
        expect(instance._sendUnsubCandles.args[0][0]).to.equal("LTCBTC");
      });
    });
  });

  describe("neutered should no-op", () => {
    let instance;
    let market = { id: "BTCUSD" };

    before(() => {
      instance = buildInstance();
      instance.hasTickers = false;
      instance.hasTrades = false;
      instance.hasLevel2Snapshots = false;
      instance.hasLevel2Updates = false;
      instance.hasLevel3Updates = false;
      instance._connect();
      instance._wss.mockEmit("connected");
    });

    it("should not send ticker sub", () => {
      instance.subscribeTicker(market);
      expect(instance._sendSubTicker.callCount).to.equal(0);
    });

    it("should not send trade sub", () => {
      instance.subscribeTrades(market);
      expect(instance._sendSubTrades.callCount).to.equal(0);
    });
    it("should not send trade unsub", () => {
      instance.unsubscribeTrades(market);
      expect(instance._sendUnsubTrades.callCount).to.equal(0);
    });
    it("should not send level2 snapshot sub", () => {
      instance.subscribeLevel2Snapshots(market);
      expect(instance._sendSubLevel2Snapshots.callCount).to.equal(0);
    });
    it("should not send level2 snapshot unsub", () => {
      instance.unsubscribeLevel2Snapshots(market);
      expect(instance._sendUnsubLevel2Snapshots.callCount).to.equal(0);
    });
    it("should not send level2 update sub", () => {
      instance.subscribeLevel2Updates(market);
      expect(instance._sendSubLevel2Updates.callCount).to.equal(0);
    });
    it("should not send level2 update unsub", () => {
      instance.unsubscribeLevel2Updates(market);
      expect(instance._sendUnsubLevel2Updates.callCount).to.equal(0);
    });
    it("should not send level3 update sub", () => {
      instance.subscribeLevel3Updates(market);
      expect(instance._sendSubLevel3Updates.callCount).to.equal(0);
    });
    it("should not send level3 update unsub", () => {
      instance.unsubscribeLevel3Updates(market);
      expect(instance._sendUnsubLevel3Updates.callCount).to.equal(0);
    });
  });
});
