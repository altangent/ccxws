import { ClientOptions } from "../ClientOptions";
import { FtxBaseClient } from "./FtxBase";

export class FtxUsClient extends FtxBaseClient {
    constructor({ wssPath = "wss://ftx.us/ws", watcherMs }: ClientOptions = {}) {
        super({ name: "FTX US", wssPath, watcherMs });
    }
}
