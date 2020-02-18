<?php

/**
 * @description This is a test file that will request file scan results from the AWS instance. Once received, the results are output to the console.
 */
require_once('./LambdaScan.php');

// if ((getenv("ACCESSIBILITY_URL") !== true) || (getenv("ACCESSIBILITY_APIKEY") !== true)) {
//     exit("Must set ACCESSIBILITY_URL and ACCESSIBILITY_APIKEY environmental variables\n");
// }

$base_url = getenv("ACCESSIBILITY_URL");
$api_key = getenv("ACCESSIBILITY_APIKEY");

$handler = new LambdaScan($base_url, $api_key);

$file_path = dirname(__FILE__) . "/../../data/comp-chemistry.pdf"; 

$credentials = $handler->getPresignedURL('/requesturl');
$put_response = $handler->putFile($credentials->uploadURL, $credentials->key, $file_path);
$scan_response = $handler->scanFile('/scan', $credentials->key);

print_r($scan_response);