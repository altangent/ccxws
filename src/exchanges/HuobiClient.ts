import { ClientOptions } from "../ClientOptions";
import { HuobiBase } from "./HuobiBase";

export class HuobiClient extends HuobiBase {
    constructor({ wssPath = "wss://api.huobi.pro/ws", watcherMs }: ClientOptions = {}) {
        super({ name: "Huobi", wssPath, watcherMs });
    }
}
