/**
 * @description This file includes a function, handler, that can used as an
 * AWS lambda function. The function will upload a file to AWS S3, then scans
 * it for accessibility.
 */

const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const uuidv4 = require("uuid/v4");
const pdfjsLib = require("pdfjs-dist");
const requestSchema = require("./schemas/request");
const responseSchema = require("./schemas/response");
const {
  getPageInfo,
  getAttachments,
  getOutline,
  getMetaData
} = require("./pdfTests");

const awsRegion = process.env.REGION || "us-east-1";
AWS.config.update({ region: awsRegion });

/**
 * @description Gets the upload URL required to post a file to s3
 * @returns Promise
 */
const getUploadURL = () =>
  new Promise(async (resolve, reject) => {
    try {
      const actionId = uuidv4();
      const s3Opts = {
        Bucket: process.env.bucketName,
        Key: actionId,
        ACL: "public-read",
        Expires: 600
      };
      const uploadURL = s3.getSignedUrl("putObject", s3Opts);

      const response = {
        statusCode: 200,
        isBase64Encoded: false,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          uploadURL: uploadURL,
          key: actionId
        })
      };

      if (await responseSchema.isValid(response)) {
        resolve(resposne);
      } else {
        return;
      }
    } catch (error) {
      reject(error);
    }
  });

/**
 * @description Reads a file from an S3 bucket into memory
 * @param {} params
 * @returns A Buffer???? Someone please check this
 */
const readFile = params =>
  new Promise((resolve, reject) => {
    s3.getObject(params, (error, data) => {
      if (error) reject(error);
      if (data.ContentLength > process.env.maxFileSizeMB * 1000000) {
        reject("File too large to process");
      }
      resolve(data.Body.toString());
    });
  });

/**
 * @description Handle requests to lambda function
 * @param {{ body: String, path: String }} request
 * @param {*} context
 * @returns Promise
 */
export const handler = async (request, context) => {
  // Make sure the request is valid before proceeding
  if (!(await requestSchema.isValid(request))) {
    return;
  }

  const { path, body } = request;

  switch (path) {
    case "/requesturl":
      return getUploadURL();
    case "/scan":
      try {
        if (!body) reject("Request body not provided");
        const req = JSON.parse(body);
        if (!req.key) reject("Key not provided");
        // IF we have the key, try to get the file
        // Get S3 bucketname from environmental variable (set in CloudFormation template)
        // Get S3 key (filename) from POST data (in JSON format)
        //console.log("Received filescan request for key: " + key);
        const bucketName = process.env.bucketName;
        const bucketOpts = { Bucket: bucketName, Key: req.key };
        const buffer = await readFile(bucketOpts);
        const testResults = await testPDFBuffer(buffer);

        const response = {
          statusCode: 200,
          isBase64Encoded: false,
          body: JSON.stringify(testResults)
        };

        if (!responseSchema.isValid(response)) {
          return;
        }

        resolve(response);
      } catch (error) {}

    default:
      returnError("Unknown request");
  }
};

/**
 * @description Performs accessibility tests on a PDF buffer
 * @param Buffer buffer
 * @returns Promise
 */
const testPDFBuffer = buffer =>
  new Promise(async (resolve, reject) => {
    const maxPages = 25;

    let testResults = {};

    try {
      const langMatch = fileBuffer
        .toString("utf8", 0, 20971520)
        .match(/lang\(([a-z\-]+?)\)/im);
      let langCode = langMatch == null ? false : langMatch[1];

      testResults.language = langCode;

      pdfjsLib
        .getDocument({
          data: fileBuffer,
          nativeImageDecoderSupport: pdfjsLib.NativeImageDecoding.NONE
        })
        .then(doc => {
          testResults.numPages = doc.numPages;
          let pendingTests = [];
          pendingTests.push(getMetaData(doc));
          //pendingTests.push(getJavaScript(doc));
          pendingTests.push(getOutline(doc));
          pendingTests.push(getAttachments(doc));
          pendingTests.push(getPageInfo(doc, maxPages));
          Promise.all(pendingTests).then(allData => {
            allData.forEach(function(data) {
              let key;
              for (key in data) {
                testResults[key] = data[key];
              }
            });
            resolve(testResults);
          });
        });
    } catch (error) {
      returnError(error);
    }
  });

/**
 * @description Handles errors thrown by other parts of the lambda function
 * @param {*} statusCode
 * @param {*} error
 */
const handleError = (statusCode, error) => ({
  statusCode,
  isBase64Encoded: false,
  body: JSON.stringify({
    error: true,
    errorMessage: error
  })
});

// Problem with a request, return the error
const returnError = reason => {
  const body = {
    error: true,
    errorMessage: reason
  };
  return {
    statusCode: 400,
    isBase64Encoded: false,
    body: JSON.stringify(body)
  };
};

/**
 * Run PDF tests on a given file Buffer
 */
