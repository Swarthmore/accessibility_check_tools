'use strict';
const AWS = require('aws-sdk');
const getYouTubeID = require('get-youtube-id');
AWS.config.update({ region: process.env.REGION || 'us-east-1' })


// Given a PDF file, return accessibility and meta data info
// AWS Lambda function connected to an API Gateway call
// The body needs to contain the key (filename) of a PDF file in S3.


exports.handler = async function(event, context) {

    console.log(event);

    if (event.path == "/youtube") {
        return checkYouTube()
    } else if (event.path == "/scan") {
        return new Promise(function(resolve, reject) {
            // Get S3 bucketname from environmental variable (set in CloudFormation template)
            // Get S3 key (filename) from POST data (in JSON format)
            var bucketName = process.env.bucketName;
            var key = null;

            if (event.body == null && event.body == undefined) {
                reject("Request body not provided");
            } else { 
                var body = JSON.parse(event.body);
                if (body.key == null && body.key == undefined) {
                    throw ("Key not provided");
                } else {
                    key = body.key;
                    console.log("Received filescan request for key: " + key);
                    resolve({Bucket:bucketName, Key: key})
                }
            } 
        }).then(readFile, returnError)
    } else {
        returnError("Unknown request");
    }
}
  

const checkYouTube = function(event) {

    console.log("Checking YouTube video");

    // Get YouTube API key from environmental variables
    var youtube_apikey = process.env.youtube_apikey;

    const promise = new Promise(function(resolve, reject) {

        if (event.body == null && event.body == undefined) {
            reject("Request body not provided");
        } else { 
            var body = JSON.parse(event.body);
            if (body.url == null && body.url == undefined) {
                throw ("YouTube url not provided");
            } else {
                youtube_url = body.url;
                var youtube_video_id = getYouTubeID("youtube_url");
                console.log("Received scan request for YouTube id: " + youtube_video_id);
                url = "https://www.googleapis.com/youtube/v3/videos?id=:" + youtube_video_id + "&part=contentDetails&key=" + youtube_apikey
                https.get(url, (res) => {
                    resolve(res.statusCode)
                    console.log(res.body);
                  }).on('error', (e) => {
                    reject(Error(e))
                  })
                })
            }
        } 



    return promise
}


//$api_data is JSON data from https://www.googleapis.com/youtube/v3/videos?id={VIDEO_ID}&part=contentDetails&key={YOUTUBE_API_KEY}
//$track_data is JSON data from https://www.googleapis.com/youtube/v3/captions?videoId={VIDEO_ID}&part=snippet&key={YOUTUBE_API_KEY}
$caption = ($api_data['items'][0]['contentDetails']['caption'] === "true");
// check to see if automatic speech recognition (ASR) caption track exists
if (!$caption){
	$caption_type = "none";
	if (count($track_data['items'])){
		foreach($track_data['items'] AS $item){
			if ($item['snippet']['status'] == "serving"){
				if ($item['snippet']['trackKind'] == "standard"){
					$caption_type = "standard";
					break; //we are good to go!
				}
				if ($item['snippet']['trackKind'] == "ASR"){
					$caption_type = "ASR";
				}
			}
		}
	}
} else { //there is a standard caption
	$caption_type = "standard";
}



// Problem with a request, return the error
const returnError = function(reason) {
    console.log("Sending error response:" + reason); 
    var body = {
        "error": true,
        "errorMessage": reason
    };
    return {
        "statusCode": 400,
        "isBase64Encoded": false,
        "body" : JSON.stringify(body)
    };
}   


// Given S3 file information, read the file into memory
function readFile (params) {
    return new Promise(function(resolve, reject) {
        s3.getObject(params, function (err, data) {
            if (!err) {
                console.log(data.ContentLength + "\n" + process.env.maxFileSizeMB * 1000)
                if (data.ContentLength > process.env.maxFileSizeMB * 1000000) {
                    reject("File too large to process");
                } else {
                    resolve(data.Body.toString());
                }
            } else {
                reject(err.code + ": " + err.message);
            }
        });
    })
    .then(testPDFBuffer, returnError);

}



/**
 * Run PDF tests on a given file Buffer
 */
const testPDFBuffer = function(fileBuffer) {

    const maxPages = 25;
    console.log("Starting test PDF buffer");
	return new Promise((resolve, reject) => {
		//Do the language test first
		let testResults = {};
		let langMatch = fileBuffer.toString('utf8', 0, 20971520).match(/lang\(([a-z\-]+?)\)/mi);
		let langCode = (langMatch == null) ? false : langMatch[1];
		testResults.language = langCode;

		//nativeImageDecoderSupport
		pdfjsLib.getDocument({
			data: fileBuffer,
			nativeImageDecoderSupport: pdfjsLib.NativeImageDecoding.NONE
		}).then((doc)  => {
  		    testResults.numPages = doc.numPages;
			let pendingTests = [];
			pendingTests.push(getMetaData(doc));
			//pendingTests.push(getJavaScript(doc));
			pendingTests.push(getOutline(doc));
			pendingTests.push(getAttachments(doc));
            pendingTests.push(getPageInfo(doc, maxPages));
			Promise.all(pendingTests).then((allData) => {
				allData.forEach(function(data){
					let key;
					for (key in data){
						testResults[key] = data[key];
					}
				});
				resolve(testResults);
			});
		});
    })
    .then(sendAPIResponse, returnError);
}

/**
 * return the parsed metadata.
 * parse the title and hasForm flag into separate elements.
 */
const getMetaData = function(doc){
	return new Promise((resolve, reject) => {
		doc.getMetadata().then((data) => {
			let noMeta = {
			 metaData : {},
			 hasForm: false,
			 hasTitle: false
		 	};
			if ('info' in data) {
				let hasForm = ('IsAcroFormPresent' in data.info) ? data.info.IsAcroFormPresent : false;
				let hasTitle = ('Title' in data.info) ? ((data.info.Title.length) ? data.info.Title : false) : false;
				resolve ({
					metaData : data.info,
					hasForm: hasForm,
					title: hasTitle
				});
			} else {
				resolve (noMeta);
			}
		}, (err) => {
			resolve (noMeta);
		});
	});
}

/**
 * extract any JavaScript and return true if any exists, false otherwise
 */
const getJavaScript = function(doc){
 	return new Promise((resolve, reject) => {
	 	doc.getJavaScript().then(function (data) {
		 	resolve({hasJavaScript: (data.length) ? true : false});
	 	}, (err) => resolve({hasJavaScript: false}));
	});
}

/**
 * see if the document conatains an Outline
 */
const getOutline = function(doc){
 	return new Promise((resolve, reject) => {
	 	doc.getOutline().then(function (data) {
			let response = { hasOutline: (data !== null) };
			if (response.hasOutline){
				response.outlineTitles = data.map(function(sec){
					return sec.title;
				});
			}
		 	resolve(response);
	 	}, (err) => resolve({hasOutline: false}));
	});
}

/**
 * see if the document conatains an Outline
 */
const getAttachments = function(doc){
 	return new Promise((resolve, reject) => {
	 	doc.getAttachments().then(function (data) {
			let response = { hasAttachements: (data !== null) };
			//TODO get attachment info
		 	resolve(response);
	 	}, (err) => resolve({hasAttachements: false}));
	});
}

/**
 * return the page content
 */
const getPageContent = function(page){
	return new Promise((resolve, reject) => {
		page.getTextContent({normalizeWhitespace: true}).then(function (content) {
			// Content contains lots of information about the text layout and
			// styles, but we need only strings at the moment
			var strings = content.items.map(function (item) {
				let trimmedText = item.str.replace(/(^\s+|\s+$)/gm, "");
				return trimmedText;
			}).filter(function (str){
				return (str.length);
			});
			resolve({pageText: strings.join(' ')});
		},(err) => resolve({pageText: ""}));
	});
}

/*
 * Get information for each page
 */
const getPageInfo = function(doc, maxPages) {
    console.log("getPageInfo");
	return new Promise((resolve, reject) => {
		if (maxPages == null || maxPages > doc.numPages){
			maxPages = doc.numPages;
		}
		let pageInfo = [];
		//get page text
		for (let i = 1; i <= maxPages ; i++){
			pageInfo.push(getSinglePageInfo(doc, i));
		}
		Promise.all(pageInfo).then((allData) => {
			let pageResults = {
				hasText: false
			};
			for (let p in allData){
				if ("pageText" in allData[p] && allData[p].pageText.length){
					pageResults.hasText = true;
					break;
				}
			}
			pageResults.pageInfo = allData;
			pageResults.numPagesChecked = maxPages;
			resolve(pageResults);
		});
	});
}

/**
 * get the info for a single page
 */
const getSinglePageInfo = function(doc, index){
	return new Promise((resolve, reject) => {
		doc.getPage(index).then((page) => getPageContent(page),(err) => resolve({pageNum: index})).then((pageContent) => {
			pageContent.pageNum = index;
			resolve(pageContent)
		}, (err) => resolve({pageNum: index}));
	});
}


/*
 * generic API response wrapper
 */
const sendAPIResponse = function(data) {
    return {
        "statusCode": 200,
        "isBase64Encoded": false,
        "body":JSON.stringify(data)
    }
}
