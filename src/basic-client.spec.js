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

let instance = new BasicClient("wss://localhost/test", "test");
instance.reconnectIntervalMs = 100;
instance._onMessage = jest.fn();
instance._sendSubscribe = jest.fn();
instance._sendUnsubscribe = jest.fn();

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeAll(() => {
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
    expect(instance._sendSubscribe.mock.calls.length).toBe(1);
    expect(instance._sendSubscribe.mock.calls[0][0]).toBe("BTCUSD");
  });
  test("it should start the reconnectChecker", () => {
    expect(instance._reconnectIntervalHandle).toBeDefined();
  });
});

describe("on subsequent subscribes", () => {
  test("it should not connect again", () => {
    instance.subscribeTrades({ id: "LTCBTC" });
    expect(instance._wss.connect.mock.calls.length).toBe(1);
  });
  test("it should send subscribe to the socket", () => {
    expect(instance._sendSubscribe.mock.calls.length).toBe(2);
    expect(instance._sendSubscribe.mock.calls[1][0]).toBe("LTCBTC");
  });
});

describe("on duplicate subscribe", () => {
  test("it should send subscribe to the socket", () => {
    instance.subscribeTrades({ id: "LTCBTC" });
    expect(instance._sendSubscribe.mock.calls.length).toBe(2);
  });
});

describe("on message", () => {
  beforeAll(() => {
    instance._wss.mockEmit("message", "test");
  });
  test("it should call on message", () => {
    expect(instance._onMessage.mock.calls[0][0]).toBe("test");
  });
  test("it should update to the current time", () => {
    expect(instance._lastMessage).toBeGreaterThan(1527261103838);
  });
});

describe("on reconnect", () => {
  test("it should resubscribe to markets", () => {
    instance._wss.mockEmit("open");
    expect(instance._sendSubscribe.mock.calls.length).toBe(4);
    expect(instance._sendSubscribe.mock.calls[2][0]).toBe("BTCUSD");
    expect(instance._sendSubscribe.mock.calls[3][0]).toBe("LTCBTC");
  });
});

describe("on unsubscribe", () => {
  test("it should send unsubscribe to socket", () => {
    instance.unsubscribeTrades({ id: "LTCBTC" });
    expect(instance._sendUnsubscribe.mock.calls.length).toBe(1);
    expect(instance._sendUnsubscribe.mock.calls[0][0]).toBe("LTCBTC");
  });
});

describe("on duplicate unsubscribe", () => {
  test("it should not send unsubscribe to the socket", () => {
    instance.unsubscribeTrades({ id: "LTCBTC" });
    expect(instance._sendUnsubscribe.mock.calls.length).toBe(1);
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
    await wait(150);
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

describe("when connected", () => {
  test("disconnect event should fire if the underlying socket closes", done => {
    instance.on("disconnected", done);
    instance._wss.mockEmit("disconnected");
  });

  test("close should emit closed event", done => {
    instance.on("closed", done);
    instance.close();
  });

  test(" should stop the reconnection checker", () => {
    expect(instance._reconnectIntervalHandle).toBeUndefined();
  });
});

describe("when already closed", () => {
  test("it should still emit closed event", done => {
    instance.on("closed", done);
    instance.close();
  });
});
