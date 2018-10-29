const https = require("https");
const url = require("url");

module.exports = {
  get,
};

async function get(uri) {
  return new Promise((resolve, reject) => {
    let { hostname, port, pathname, search } = url.parse(uri);
    let req = https.get(
      {
        host: hostname,
        port,
        path: pathname + search,
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
    req.end();
  });
}
