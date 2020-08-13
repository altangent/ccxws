const HuobiBase = require("./huobi-base");

class HuobiSwapsClient extends HuobiBase {
  constructor() {
    super({ name: "Huobi Swaps", wssPath: "wss://api.hbdm.com/swap-ws " });
    this.hasLevel2Updates = true;
  }
}

module.exports = HuobiSwapsClient;
