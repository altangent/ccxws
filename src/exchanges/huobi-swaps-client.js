const HuobiBase = require("./huobi-base");

class HuobiSwapsClient extends HuobiBase {
  constructor({ wssPath = "wss://api.hbdm.com/swap-ws", watcherMs } = {}) {
    super({ name: "Huobi Swaps", wssPath, watcherMs });
    this.hasLevel2Updates = true;
  }
}

module.exports = HuobiSwapsClient;
