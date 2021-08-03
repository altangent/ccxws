export type Fn = (...args: any[]) => void;
export type CancelableFn = { (...args: any[]): void; cancel: () => void };
