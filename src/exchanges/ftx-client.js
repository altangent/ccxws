const FtxBaseClient = require("./ftx-base");

class FtxClient extends FtxBaseClient {
  constructor() {
    super({ name: "FTX", wssPath: "wss://ftx.com/ws" });
  }
}

module.exports = FtxClient;
