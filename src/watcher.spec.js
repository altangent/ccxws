const EventEmitter = require("events").EventEmitter;
const Watcher = require("./watcher");

class MockClient extends EventEmitter {
  constructor() {
    super();
    this.reconnect = jest.fn();
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let sut;
let client;

beforeAll(() => {
  client = new MockClient();
  sut = new Watcher(client, 100);
  jest.spyOn(sut, "stop");
});

describe("start", () => {
  beforeAll(() => {
    sut.start();
  });
  test("should trigger a stop", () => {
    expect(sut.stop).toHaveBeenCalledTimes(1);
  });
  test("should start the interval", () => {
    expect(sut._intervalHandle).toBeDefined();
  });
});

describe("stop", () => {
  beforeAll(() => {
    sut.stop();
  });
  test("should clear the interval", () => {
    expect(sut._intervalHandle).toBeUndefined();
  });
});

describe("on messages", () => {
  beforeEach(() => {
    sut._lastMessage = undefined;
  });
  test("other should not mark", () => {
    client.emit("other");
    expect(sut._lastMessage).toBeUndefined();
  });
  test("trade should mark", () => {
    client.emit("trade");
    expect(sut._lastMessage).toBeDefined();
  });
  test("l2snapshot should mark", () => {
    client.emit("l2snapshot");
    expect(sut._lastMessage).toBeDefined();
  });
  test("l2update should mark", () => {
    client.emit("l2update");
    expect(sut._lastMessage).toBeDefined();
  });
  test("l3snapshot should mark", () => {
    client.emit("l3snapshot");
    expect(sut._lastMessage).toBeDefined();
  });
  test("l3update should mark", () => {
    client.emit("l3update");
    expect(sut._lastMessage).toBeDefined();
  });
});

describe("on expire", () => {
  beforeAll(() => {
    sut.start();
  });
  test("it should call reconnect on the client", async () => {
    await wait(150);
    expect(client.reconnect).toHaveBeenCalledTimes(1);
  });
});
