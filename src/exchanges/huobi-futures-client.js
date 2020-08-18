const HuobiBase = require("./huobi-base");

class HuobiFuturesClient extends HuobiBase {
  constructor({ wssPath = "wss://api.hbdm.com/ws", watcherMs } = {}) {
    super({ name: "Huobi Futures", wssPath, watcherMs });
    this.hasLevel2Updates = true;
  }
}

module.exports = HuobiFuturesClient;
