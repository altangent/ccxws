const https = require("https");
const url = require("url");

module.exports = {
  get,
  getResponse,
  post,
};

/**
 * Maks an HTTPS GET request to the specified URI and returns the parsed JSON
 * body data.
 * @param {String} uri
 * @returns {Object} parsed body
 */
async function get(uri) {
  const { data } = await getResponse(uri);
  return data;
}

/**
 * Make an HTTPS GET request to the specified URI and returns the parsed JSON
 * body data as well as the full response.
 *
 * @param {String} uri
 * @returns {Object} { data: <parsed JSON body>, response: <http.IncomingMessage> }
 */
async function getResponse(uri) {
  return new Promise((resolve, reject) => {
    let req = https.get(url.parse(uri), res => {
      let results = [];
      res.on("error", reject);
      res.on("data", data => results.push(data));
      res.on("end", () => {
        results = Buffer.concat(results);
        if (res.statusCode !== 200) {
          return reject(new Error(results.toString()));
        } else {
          const resultsParsed = JSON.parse(results);
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

async function post(uri, postData = "") {
  return new Promise((resolve, reject) => {
    let { hostname, port, pathname } = url.parse(uri);

    let req = https.request(
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
        let results = [];
        res.on("error", reject);
        res.on("data", data => results.push(data));
        res.on("end", () => {
          results = Buffer.concat(results);
          if (res.statusCode !== 200) {
            return reject(results.toString());
          } else {
            return resolve(JSON.parse(results));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}
