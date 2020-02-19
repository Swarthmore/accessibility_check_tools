'use strict';
const AWS = require('aws-sdk');
const https = require('https');
//const getYouTubeID = require('get-youtube-id');
AWS.config.update({ region: process.env.REGION || 'us-east-1' })

// Get YouTube API key from environmental variables
var youtube_apikey = process.env.youtube_apikey;

// Given a PDF file, return accessibility and meta data info
// AWS Lambda function connected to an API Gateway call
// The body needs to contain the key (filename) of a PDF file in S3.


exports.handler = async function(event, context) {
    console.log(event);
    if (event.path == "/youtube") {
        return checkYouTube(event);
    } else {
        returnError("Unknown request");
    }
};
  

const checkYouTube = function(event) {

    console.log("Checking YouTube video");



    return new Promise(function(resolve, reject) {
        console.log(event.body);
        if (event.body == null && event.body == undefined) {
            reject("Request body not provided");
        } else {
            var body = JSON.parse(event.body);
            if (body.url == null && body.url == undefined) {
                throw ("YouTube url not provided");
            } else {
                var youtube_url = body.url;
                //var youtube_video_id = getYouTubeID("youtube_url");
                var youtube_video_id = 'IW4MEi9BNJo';
                console.log("Received scan request for YouTube id: " + youtube_video_id);
                var url = "https://www.googleapis.com/youtube/v3/videos?id=" + youtube_video_id + "&part=contentDetails&key=" + youtube_apikey;
                console.log("URL: " + url);
                https.get(url, (res) => {
                    console.log(res.body);
                    let rawData = '';
                    res.on('data', (chunk) => { rawData += chunk; });
                    res.on('end', () => {
                        var response;
                        try {
                            response = JSON.parse(rawData);
                            console.log(response);
                        } catch (e) {
                            console.error(e.message);
                            response = e.message;
                            reject(e.message);
                        }
                        resolve({youtube_video_id:youtube_video_id, api_data: response});
                    });
                    
                }).on('error', (e) => {
                    reject(Error(e));
                });
            }
        }
        
    }).then(function(data) { // (**)

        return new Promise(function(resolve, reject) {
            console.log(data);
            var url = "https://www.googleapis.com/youtube/v3/captions?videoId=" + data.youtube_video_id + "&part=snippet&key=" + youtube_apikey;
            console.log("URL: " + url);
            https.get(url, (res) => {
                console.log(res.body);
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(rawData);
                        console.log(response);
                        data.track_data = response;
                    } catch (e) {
                        console.error(e.message);
                        reject(e.message);
                    }
                    resolve(data);
                });
                    
            }).on('error', (e) => {
                reject(Error(e));
            });
        });
    }).then(function(data) {
        var caption = (data.api_data.items[0].contentDetails.caption) == true;
        var caption_type;
        // check to see if automatic speech recognition (ASR) caption track exists
        if (!caption){
	        caption_type = "none";
	        if (data.track_data.items.length) {
	            for (var i = 0; i < data.track_data.items.length; i++) {      
			        if (data.track_data.items[i].snippet.status == "serving") {
				        if (data.track_data.items[i].snippet.trackKind == "standard"){
					        caption_type = "standard";
					        break; //we are good to go!
				        }
				        if (data.track_data.items[i].snippet.trackKind == "ASR"){
					        caption_type = "ASR";
				        }
			        }
		        }
	        }
        } else { //there is a standard caption
	        caption_type = "standard";
        }
        console.log(caption_type);
        return caption_type;
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
    };
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