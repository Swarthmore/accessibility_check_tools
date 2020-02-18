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

/**
 * return the parsed metadata.
 * parse the title and hasForm flag into separate elements.
 */
const getMetaData = function(doc) {
  return new Promise((resolve, reject) => {
    doc.getMetadata().then(
      data => {
        let noMeta = {
          metaData: {},
          hasForm: false,
          hasTitle: false
        };
        if ("info" in data) {
          let hasForm =
            "IsAcroFormPresent" in data.info
              ? data.info.IsAcroFormPresent
              : false;
          let hasTitle =
            "Title" in data.info
              ? data.info.Title.length
                ? data.info.Title
                : false
              : false;
          resolve({
            metaData: data.info,
            hasForm: hasForm,
            title: hasTitle
          });
        } else {
          resolve(noMeta);
        }
      },
      err => {
        resolve(noMeta);
      }
    );
  });
};

/**
 * extract any JavaScript and return true if any exists, false otherwise
 */
const getJavaScript = function(doc) {
  return new Promise((resolve, reject) => {
    doc.getJavaScript().then(
      function(data) {
        resolve({ hasJavaScript: data.length ? true : false });
      },
      err => resolve({ hasJavaScript: false })
    );
  });
};

/**
 * see if the document conatains an Outline
 */
const getOutline = function(doc) {
  return new Promise((resolve, reject) => {
    doc.getOutline().then(
      function(data) {
        let response = { hasOutline: data !== null };
        if (response.hasOutline) {
          response.outlineTitles = data.map(function(sec) {
            return sec.title;
          });
        }
        resolve(response);
      },
      err => resolve({ hasOutline: false })
    );
  });
};

/**
 * @description See if the document contains an outline
 * @param {} doc
 * @returns Promnise
 */
const getAttachments = doc =>
  new Promise(async (resolve, reject) => {
    try {
      const attachments = await doc.getAttachments();
      resolve({ hasAttachments: attachments !== null });
    } catch (error) {
      resolve({ hasAttachements: false });
    }
  });

/**
 * @description Get the page content
 * @param {} page
 * @returns Promise
 */
const getPageContent = page =>
  new Promise(async (resolve, reject) => {
    try {
      const content = await page.getTextContent({ normalizeWhitespace: true });

      // Content contains lots of information about the text layout and
      // styles, but we need only strings at the moment
      const strings = content.items
        .map(item => item.str.replace(/(^\s+|\s+$)/gm, ""))
        .filter(str => str.length);
      resolve({ pageText: strings.join(" ") });
    } catch (error) {
      resolve({ pageText: "" });
    }
  });

/**
 * @description Get information for each page
 * @param {*} doc
 * @param {Number} maxPages
 * @returns Promise
 */
const getPageInfo = (doc, maxPages) =>
  new Promise(async (resolve, reject) => {
    try {
      if (maxPages == null || maxPages > doc.numPages) {
        maxPages = doc.numPages;
      }
      let pageInfo = [];

      //get page text
      for (let i = 1; i <= maxPages; i++) {
        pageInfo.push(getSinglePageInfo(doc, i));
      }

      const data = await Promise.all(pageInfo);

      let pageResults = { hasText: false };

      for (let p in data) {
        if ("pageText" in data[p] && data[p].pageText.length) {
          pageResults.hasText = true;
          break;
        }
      }
      pageResults.pageInfo = data;
      pageResults.numPagesChecked = maxPages;
      resolve(pageResults);
    } catch (error) {
      reject(error);
    }
  });

/**
 * get the info for a single page
 */
const getSinglePageInfo = function(doc, index) {
  return new Promise((resolve, reject) => {
    doc
      .getPage(index)
      .then(
        page => getPageContent(page),
        err => resolve({ pageNum: index })
      )
      .then(
        pageContent => {
          pageContent.pageNum = index;
          resolve(pageContent);
        },
        err => resolve({ pageNum: index })
      );
  });
};
