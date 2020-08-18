const FtxBaseClient = require("./ftx-base");

class FtxClient extends FtxBaseClient {
  constructor({ wssPath = "wss://ftx.com/ws", watcherMs } = {}) {
    super({ name: "FTX", wssPath, watcherMs });
  }
}

module.exports = FtxClient;
