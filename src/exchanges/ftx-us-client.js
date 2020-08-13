const FtxBaseClient = require("./ftx-base");

class FtxUsClient extends FtxBaseClient {
  constructor() {
    super({ name: "FTX US", wssPath: "wss://ftx.us/ws" });
  }
}

module.exports = FtxUsClient;
