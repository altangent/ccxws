/* eslint-disable @typescript-eslint/require-await */

export const NotImplementedFn: (...args: any[]) => any = () => new Error("Not implemented");
export const NotImplementedAsyncFn: (...args: any[]) => Promise<any> = async () =>
    new Error("Not implemented");
