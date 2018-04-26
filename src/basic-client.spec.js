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
instance._onMessage = jest.fn();
instance._sendSubscribe = jest.fn();
instance._sendUnsubscribe = jest.fn();

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
  test("it should call on message", () => {
    instance._wss.mockEmit("message", "test");
    expect(instance._onMessage.mock.calls[0][0]).toBe("test");
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

describe("when connected", () => {
  test("disconnect event should fire if the underlying socket closes", done => {
    instance.on("disconnected", done);
    instance._wss.mockEmit("disconnected");
  });

  test("close should emit closed event", done => {
    instance.on("closed", done);
    instance.close();
  });
});

describe("when already closed", () => {
  test("it should still emit closed event", done => {
    instance.on("closed", done);
    instance.close();
  });
});
