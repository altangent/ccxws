import { ClientOptions } from "../ClientOptions";
import { HuobiBase } from "./HuobiBase";

export class HuobiFuturesClient extends HuobiBase {
    constructor({ wssPath = "wss://api.hbdm.com/ws", watcherMs }: ClientOptions = {}) {
        super({ name: "Huobi Futures", wssPath, watcherMs });
        this.hasLevel2Updates = true;
    }
}
