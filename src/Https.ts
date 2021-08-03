import { IncomingMessage } from "http";
import https from "https";
import url from "url";

/**
 * Maks an HTTPS GET request to the specified URI and returns the parsed JSON
 * body data.
 */
export async function get<T>(uri: string): Promise<T> {
    const result = await getResponse<T>(uri);
    return result.data;
}

/**
 * Make an HTTPS GET request to the specified URI and returns the parsed JSON
 * body data as well as the full response.
 */
export async function getResponse<T>(uri: string): Promise<{ data: T; response: IncomingMessage }> {
    return new Promise((resolve, reject) => {
        const req = https.get(url.parse(uri), res => {
            const results: Buffer[] = [];
            res.on("error", reject);
            res.on("data", (data: Buffer) => results.push(data));
            res.on("end", () => {
                const finalResults = Buffer.concat(results).toString();
                if (res.statusCode !== 200) {
                    return reject(new Error(results.toString()));
                } else {
                    const resultsParsed = JSON.parse(finalResults) as T;
                    return resolve({
                        data: resultsParsed,
                        response: res,
                    });
                }
            });
        });
        req.on("error", reject);
        req.end();
    });
}

export async function post<T>(uri: string, postData: string = ""): Promise<T> {
    return new Promise((resolve, reject) => {
        const { hostname, port, pathname } = url.parse(uri);

        const req = https.request(
            {
                host: hostname,
                port,
                path: pathname,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": postData.length,
                },
            },
            res => {
                const results: Buffer[] = [];
                res.on("error", reject);
                res.on("data", data => results.push(data));
                res.on("end", () => {
                    const finalResults = Buffer.concat(results).toString();
                    if (res.statusCode !== 200) {
                        return reject(results.toString());
                    } else {
                        return resolve(JSON.parse(finalResults));
                    }
                });
            },
        );
        req.on("error", reject);
        req.write(postData);
        req.end();
    });
}
