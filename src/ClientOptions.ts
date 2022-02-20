export type ClientOptions = {
    wssPath?: string;
    watcherMs?: number;
    throttleMs?: number;
    retryTimeoutMs?: number;
    l2UpdateDepth?: number;
    throttleL2Snapshot?: number;
};
