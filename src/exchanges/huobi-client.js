const HuobiBase = require("./huobi-base");

class HuobiClient extends HuobiBase {
  constructor({ wssPath = "wss://api.huobi.pro/ws", watcherMs } = {}) {
    super({ name: "Huobi", wssPath, watcherMs });
  }
}

module.exports = HuobiClient;
