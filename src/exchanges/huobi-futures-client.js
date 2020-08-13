const HuobiBase = require("./huobi-base");

class HuobiFuturesClient extends HuobiBase {
  constructor() {
    super({ name: "Huobi Futures", wssPath: "wss://api.hbdm.com/ws " });
    this.hasLevel2Updates = true;
  }
}

module.exports = HuobiFuturesClient;
