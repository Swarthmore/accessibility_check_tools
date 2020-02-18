const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const handleError = error => {
  throw new Error(error);
};

if (!("ACCESSIBILITY_URL" in process.env) || !("ACCESSIBILITY_APIKEY" in process.env)) { 
    console.log("Environmental variables ACCESSIBILITY_URL and ACCESSIBILITY_APIKEY not set."); 
    process.exit()
}

const baseURL = process.env.ACCESSIBILITY_URL;
const apikey = process.env.ACCESSIBILITY_APIKEY;

const getPresignedURL = async ({ url }) => {
  try {
    const headers = {  'x-api-key': apikey }
    const opts = { method: "GET" , headers: headers};
    const res = await fetch(url, opts);
    const { uploadURL, key } = await res.json();
    console.log(`Request Presigned URL for S3 Upload\nS3 signed URL: ${uploadURL}\nKey: ${key}\n`);
    return { uploadURL, key };
  } catch (error) {
    handleError(error);
  }
};

const putFileIntoBucket = async ({ uploadURL, key, filePath }) => {
  try {
    const file = fs.readFileSync(filePath);
    const headers = { filename: key };
    const opts = { method: "PUT", headers, body: file };
    const res = await fetch(uploadURL, opts);
    return res;
  } catch (error) {
    handleError(error);
  }
};

const scanFile = async ({ url, key }) => {
  try {
    const headers = { 'Content-Type': 'application/json', 'x-api-key': apikey }
    const body = JSON.stringify({ key });
    const opts = { method: "POST", headers, body };
    const res = await fetch(url, opts);
    const json = await res.json();
    console.log("Accessibility scan result:");
    console.log(json)
    return json;
  } catch (error) {
    handleError(error);
  }
};

(async () => {
  const reqURL = baseURL + "/requesturl";
  const scanURL = baseURL + "/scan";
  const filePath = path.resolve(__dirname, "..", "..", "data", "comp-biology.pdf");

  const { uploadURL, key } = await getPresignedURL({ url: reqURL });
  const bucketRes = await putFileIntoBucket({ uploadURL, key, filePath });
  const scanRes = await scanFile({ url: scanURL, key })

})();