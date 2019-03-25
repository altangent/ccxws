const https = require("https");
const url = require("url");

module.exports = {
  get,
};

async function get(uri) {
  return new Promise((resolve, reject) => {
    let req = https.get(url.parse(uri), res => {
      let results = [];
      res.on("error", reject);
      res.on("data", data => results.push(data));
      res.on("end", () => {
        results = Buffer.concat(results);
        if (res.statusCode !== 200) {
          console.log(res.statusCode);
          return reject(new Error(results.toString()));
        } else {
          return resolve(JSON.parse(results));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}
