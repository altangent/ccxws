const HuobiBase = require("./huobi-base");

class HuobiJapanClient extends HuobiBase {
  constructor({ wssPath = "wss://api-cloud.huobi.co.jp/ws", watcherMs } = {}) {
    super({ name: "Huobi Japan", wssPath, watcherMs });
  }
}

module.exports = HuobiJapanClient;
