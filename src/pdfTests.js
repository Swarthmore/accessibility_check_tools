/**
 * @description Get the info for a single page
 */
const getSinglePageInfo = (doc, index) =>
  new Promise((resolve, reject) => {
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
 * @description See if the document conatains an Outline
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
 * @description Extract any JavaScript and return true if any exists, false otherwise
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
 * @description Returns the parsed metadata.
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

module.exports = {
  getSinglePageInfo,
  getPageInfo,
  getPageContent,
  getAttachments,
  getOutline,
  getJavaScript,
  getMetaData
};
