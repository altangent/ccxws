import { ClientOptions } from "../ClientOptions";
import { HuobiBase } from "./HuobiBase";

export class HuobiJapanClient extends HuobiBase {
    constructor({ wssPath = "wss://api-cloud.huobi.co.jp/ws", watcherMs }: ClientOptions = {}) {
        super({ name: "Huobi Japan", wssPath, watcherMs });
    }
}
