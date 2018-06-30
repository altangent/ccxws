let BasicClient = require("./basic-client");
jest.mock("winston", () => ({ info: jest.fn() }));
jest.mock("./smart-wss", () => {
  return function mockSmartWss() {
    return {
      _events: {},
      connect: jest.fn(),
      close: jest.fn(),
      on: function(event, handler) {
        this._events[event] = handler;
      },
      mockEmit: function(event, payload) {
        if (event === "open") this.isConnected = true;
        this._events[event](payload);
      },
      isConnected: false,
    };
  };
});

function buildInstance() {
  let instance = new BasicClient("wss://localhost/test", "test");
  instance._watcher.intervalMs = 100;
  instance.hasLevel2Snapshots = true;
  instance.hasLevel2Updates = true;
  instance.hasLevel3Updates = true;
  instance._onMessage = jest.fn();
  instance._sendSubTrades = jest.fn();
  instance._sendUnsubTrades = jest.fn();
  instance._sendSubLevel2Snapshots = jest.fn();
  instance._sendUnsubLevel2Snapshots = jest.fn();
  instance._sendSubLevel2Updates = jest.fn();
  instance._sendUnsubLevel2Updates = jest.fn();
  instance._sendSubLevel3Updates = jest.fn();
  instance._sendUnsubLevel3Updates = jest.fn();

  jest.spyOn(instance._watcher, "start");
  jest.spyOn(instance._watcher, "stop");
  return instance;
}

let instance;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeAll(() => {
  instance = buildInstance();
  instance._connect();
});

describe("on first subscribe", () => {
  test("it should open a connection", () => {
    instance.subscribeTrades({ id: "BTCUSD" });
    expect(instance._wss).toBeDefined();
    expect(instance._wss.connect.mock.calls.length).toBe(1);
  });
  test("it should send subscribe to the socket", () => {
    instance._wss.mockEmit("open");
    expect(instance._sendSubTrades.mock.calls.length).toBe(1);
    expect(instance._sendSubTrades.mock.calls[0][0]).toBe("BTCUSD");
  });
  test("it should start the watcher", () => {
    expect(instance._watcher.start).toHaveBeenCalledTimes(1);
  });
});

describe("on subsequent subscribes", () => {
  test("it should not connect again", () => {
    instance.subscribeTrades({ id: "LTCBTC" });
    expect(instance._wss.connect.mock.calls.length).toBe(1);
  });
  test("it should send subscribe to the socket", () => {
    expect(instance._sendSubTrades.mock.calls.length).toBe(2);
    expect(instance._sendSubTrades.mock.calls[1][0]).toBe("LTCBTC");
  });
});

describe("on duplicate subscribe", () => {
  test("it should not send subscribe to the socket", () => {
    instance.subscribeTrades({ id: "LTCBTC" });
    expect(instance._sendSubTrades.mock.calls.length).toBe(2);
  });
});

describe("on message", () => {
  beforeAll(() => {
    instance._wss.mockEmit("message", "test");
  });
  test("it should call on message", () => {
    expect(instance._onMessage.mock.calls[0][0]).toBe("test");
  });
});

describe("on reconnect", () => {
  test("it should resubscribe to markets", () => {
    instance._wss.mockEmit("open");
    expect(instance._sendSubTrades.mock.calls.length).toBe(4);
    expect(instance._sendSubTrades.mock.calls[2][0]).toBe("BTCUSD");
    expect(instance._sendSubTrades.mock.calls[3][0]).toBe("LTCBTC");
  });
});

describe("on unsubscribe", () => {
  test("it should send unsubscribe to socket", () => {
    instance.unsubscribeTrades({ id: "LTCBTC" });
    expect(instance._sendUnsubTrades.mock.calls.length).toBe(1);
    expect(instance._sendUnsubTrades.mock.calls[0][0]).toBe("LTCBTC");
  });
});

describe("on duplicate unsubscribe", () => {
  test("it should not send unsubscribe to the socket", () => {
    instance.unsubscribeTrades({ id: "LTCBTC" });
    expect(instance._sendUnsubTrades.mock.calls.length).toBe(1);
  });
});

describe("when no messages received", () => {
  let originalWss;
  let closedEvent = jest.fn();
  let reconnectedEvent = jest.fn();
  beforeAll(async () => {
    originalWss = instance._wss;
    instance.on("closed", closedEvent);
    instance.on("reconnected", reconnectedEvent);
    instance.emit("trade"); // triggers the connection watcher
    await wait(300);
  });
  test("it should close the connection", () => {
    expect(originalWss.close.mock.calls.length).toBe(1);
  });
  test("it should not emit a closed event", () => {
    expect(closedEvent.mock.calls.length).toBe(0);
  });
  test("it should reopen the connection", () => {
    expect(instance._wss).not.toEqual(originalWss);
    expect(instance._wss.connect.mock.calls.length).toBe(1);
  });
  test("should emit a reconnected event", () => {
    expect(reconnectedEvent.mock.calls.length).toBe(1);
  });
});

describe("when connected, on disconnect", () => {
  test("disconnect event should fire if the underlying socket closes", done => {
    instance._watcher.stop.mockClear();
    instance.on("disconnected", done);
    instance._wss.mockEmit("disconnected");
  });

  test("close should stop the reconnection checker", () => {
    expect(instance._watcher.stop).toHaveBeenCalledTimes(1);
  });
});

describe("when connected, stop", () => {
  test("close should emit closed event", done => {
    instance._watcher.stop.mockClear();
    instance.on("closed", done);
    instance.close();
  });

  test("close should stop the reconnection checker", () => {
    expect(instance._watcher.stop).toHaveBeenCalledTimes(1);
  });
});

describe("when already closed", () => {
  test("it should still emit closed event", done => {
    instance.on("closed", done);
    instance.close();
  });
});

describe("level2 snapshots", () => {
  let instance;

  beforeAll(() => {
    instance = buildInstance();
    instance._connect();
  });

  describe("on first subscribe", () => {
    test("it should open a connection", () => {
      instance.subscribeLevel2Snapshots({ id: "BTCUSD" });
      expect(instance._wss).toBeDefined();
      expect(instance._wss.connect.mock.calls.length).toBe(1);
    });
    test("it should send subscribe to the socket", () => {
      instance._wss.mockEmit("open");
      expect(instance._sendSubLevel2Snapshots.mock.calls.length).toBe(1);
      expect(instance._sendSubLevel2Snapshots.mock.calls[0][0]).toBe("BTCUSD");
    });
    test("it should start the reconnectChecker", () => {
      expect(instance._watcher.start).toHaveBeenCalledTimes(1);
    });
  });

  describe("on subsequent subscribes", () => {
    test("it should not connect again", () => {
      instance.subscribeLevel2Snapshots({ id: "LTCBTC" });
      expect(instance._wss.connect.mock.calls.length).toBe(1);
    });
    test("it should send subscribe to the socket", () => {
      expect(instance._sendSubLevel2Snapshots.mock.calls.length).toBe(2);
      expect(instance._sendSubLevel2Snapshots.mock.calls[1][0]).toBe("LTCBTC");
    });
  });

  describe("on unsubscribe", () => {
    test("it should send unsubscribe to socket", () => {
      instance.unsubscribeLevel2Snapshots({ id: "LTCBTC" });
      expect(instance._sendUnsubLevel2Snapshots.mock.calls.length).toBe(1);
      expect(instance._sendUnsubLevel2Snapshots.mock.calls[0][0]).toBe("LTCBTC");
    });
  });
});

describe("level2 updates", () => {
  let instance;

  beforeAll(() => {
    instance = buildInstance();
    instance._connect();
  });

  describe("on first subscribe", () => {
    test("it should open a connection", () => {
      instance.subscribeLevel2Updates({ id: "BTCUSD" });
      expect(instance._wss).toBeDefined();
      expect(instance._wss.connect.mock.calls.length).toBe(1);
    });
    test("it should send subscribe to the socket", () => {
      instance._wss.mockEmit("open");
      expect(instance._sendSubLevel2Updates.mock.calls.length).toBe(1);
      expect(instance._sendSubLevel2Updates.mock.calls[0][0]).toBe("BTCUSD");
    });
    test("it should start the reconnectChecker", () => {
      expect(instance._watcher.start).toHaveBeenCalledTimes(1);
    });
  });

  describe("on subsequent subscribes", () => {
    test("it should not connect again", () => {
      instance.subscribeLevel2Updates({ id: "LTCBTC" });
      expect(instance._wss.connect.mock.calls.length).toBe(1);
    });
    test("it should send subscribe to the socket", () => {
      expect(instance._sendSubLevel2Updates.mock.calls.length).toBe(2);
      expect(instance._sendSubLevel2Updates.mock.calls[1][0]).toBe("LTCBTC");
    });
  });

  describe("on unsubscribe", () => {
    test("it should send unsubscribe to socket", () => {
      instance.unsubscribeLevel2Updates({ id: "LTCBTC" });
      expect(instance._sendUnsubLevel2Updates.mock.calls.length).toBe(1);
      expect(instance._sendUnsubLevel2Updates.mock.calls[0][0]).toBe("LTCBTC");
    });
  });
});

describe("level3 updates", () => {
  let instance;

  beforeAll(() => {
    instance = buildInstance();
    instance._connect();
  });

  describe("on first subscribe", () => {
    test("it should open a connection", () => {
      instance.subscribeLevel3Updates({ id: "BTCUSD" });
      expect(instance._wss).toBeDefined();
      expect(instance._wss.connect.mock.calls.length).toBe(1);
    });
    test("it should send subscribe to the socket", () => {
      instance._wss.mockEmit("open");
      expect(instance._sendSubLevel3Updates.mock.calls.length).toBe(1);
      expect(instance._sendSubLevel3Updates.mock.calls[0][0]).toBe("BTCUSD");
    });
    test("it should start the reconnectChecker", () => {
      expect(instance._watcher.start).toHaveBeenCalledTimes(1);
    });
  });

  describe("on subsequent subscribes", () => {
    test("it should not connect again", () => {
      instance.subscribeLevel3Updates({ id: "LTCBTC" });
      expect(instance._wss.connect.mock.calls.length).toBe(1);
    });
    test("it should send subscribe to the socket", () => {
      expect(instance._sendSubLevel3Updates.mock.calls.length).toBe(2);
      expect(instance._sendSubLevel3Updates.mock.calls[1][0]).toBe("LTCBTC");
    });
  });

  describe("on unsubscribe", () => {
    test("it should send unsubscribe to socket", () => {
      instance.unsubscribeLevel3Updates({ id: "LTCBTC" });
      expect(instance._sendUnsubLevel3Updates.mock.calls.length).toBe(1);
      expect(instance._sendUnsubLevel3Updates.mock.calls[0][0]).toBe("LTCBTC");
    });
  });
});

describe("neutered should no-op", () => {
  let instance;
  let market = { id: "BTCUSD" };

  beforeAll(() => {
    instance = buildInstance();
    instance.hasTrades = false;
    instance.hasLevel2Snapshots = false;
    instance.hasLevel2Updates = false;
    instance.hasLevel3Updates = false;
    instance._connect();
    instance._wss.mockEmit("open");
  });

  test("it should not send trade sub", () => {
    instance.subscribeTrades(market);
    expect(instance._sendSubTrades.mock.calls.length).toBe(0);
  });
  test("it should not send trade unsub", () => {
    instance.unsubscribeTrades(market);
    expect(instance._sendUnsubTrades.mock.calls.length).toBe(0);
  });
  test("it should not send level2 snapshot sub", () => {
    instance.subscribeLevel2Snapshots(market);
    expect(instance._sendSubLevel2Snapshots.mock.calls.length).toBe(0);
  });
  test("it should not send level2 snapshot unsub", () => {
    instance.unsubscribeLevel2Snapshots(market);
    expect(instance._sendUnsubLevel2Snapshots.mock.calls.length).toBe(0);
  });
  test("it should not send level2 update sub", () => {
    instance.subscribeLevel2Updates(market);
    expect(instance._sendSubLevel2Updates.mock.calls.length).toBe(0);
  });
  test("it should not send level2 update unsub", () => {
    instance.unsubscribeLevel2Updates(market);
    expect(instance._sendUnsubLevel2Updates.mock.calls.length).toBe(0);
  });
  test("it should not send level3 update sub", () => {
    instance.subscribeLevel3Updates(market);
    expect(instance._sendSubLevel3Updates.mock.calls.length).toBe(0);
  });
  test("it should not send level3 update unsub", () => {
    instance.unsubscribeLevel3Updates(market);
    expect(instance._sendUnsubLevel3Updates.mock.calls.length).toBe(0);
  });
});
