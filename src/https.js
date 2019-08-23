const https = require("https");
const url = require("url");

module.exports = {
  get,
  post,
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
          "Content-Length": postData.length
        }
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
