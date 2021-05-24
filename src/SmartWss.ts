/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { EventEmitter } from "events";
import WebSocket from "ws";
import { wait } from "./Util";

export class SmartWss extends EventEmitter {
    private _retryTimeoutMs: number;
    private _connected: boolean;
    private _wss: any;

    constructor(readonly wssPath: string) {
        super();
        this._retryTimeoutMs = 15000;
        this._connected = false;
    }

    /**
     * Gets if the socket is currently connected
     */
    public get isConnected() {
        return this._connected;
    }

    /**
     * Attempts to connect
     */
    public async connect(): Promise<void> {
        await this._attemptConnect();
    }

    /**
     * Closes the connection
     */
    public close(): void {
        this.emit("closing");
        if (this._wss) {
            this._wss.removeAllListeners();
            this._wss.on("close", () => this.emit("closed"));
            this._wss.on("error", err => {
                if (err.message !== "WebSocket was closed before the connection was established")
                    return;
                this.emit("error", err);
            });
            this._wss.close();
        }
    }

    /**
     * Sends the data if the socket is currently connected.
     * Otherwise the consumer needs to retry to send the information
     * when the socket is connected.
     */
    public send(data: string) {
        if (this._connected) {
            try {
                this._wss.send(data);
            } catch (e) {
                this.emit("error", e);
            }
        }
    }

    /////////////////////////

    /**
     * Attempts a connection and will either fail or timeout otherwise.
     */
    private _attemptConnect(): Promise<void> {
        return new Promise(resolve => {
            const wssPath = this.wssPath;
            this.emit("connecting");
            this._wss = new WebSocket(wssPath, {
                perMessageDeflate: false,
                handshakeTimeout: 15000,
            });
            this._wss.on("open", () => {
                this._connected = true;
                this.emit("open"); // deprecated
                this.emit("connected");
                resolve();
            });
            this._wss.on("close", () => this._closeCallback());
            this._wss.on("error", err => this.emit("error", err));
            this._wss.on("message", msg => this.emit("message", msg));
        });
    }

    /**
     * Handles the closing event by reconnecting
     */
    private _closeCallback(): void {
        this._connected = false;
        this._wss = null;
        this.emit("disconnected");
        void this._retryConnect();
    }

    /**
     * Perform reconnection after the timeout period
     * and will loop on hard failures
     */
    private async _retryConnect(): Promise<void> {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                await wait(this._retryTimeoutMs);
                await this._attemptConnect();
                return;
            } catch (ex) {
                this.emit("error", ex);
            }
        }
    }
}
