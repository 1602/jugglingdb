/*
* Usage: node-streamline googleClient searchString
*
* Demonstrates the streamline http client wrapper
*/

// require the streamline streams wrapper
var streams = require('../lib/server/streams');

function google(str, _) {
	// Create the request.
	// The options are the same as for node's http.request call.
	// But the call also accepts a simple URL for the GET case
	// But streams.requestRequest does not take any callback parameter.
	// Instead, the callback is passed to the response(_) method (a few lines below).
	var req = streams.httpRequest({
		url: 'http://ajax.googleapis.com/ajax/services/search/web?v=1.0&q=' + str,
		proxy: process.env.http_proxy
	});
	
	// In the case of a POST request, this is where you would send
	// the body with req.write calls.
	
	// End the request and get a response object (asynchronously)
	var resp = req.end().response(_);
	// Check the status, read the whole body (asynchronously) and parse it.
	return JSON.parse(resp.checkStatus(200).readAll(_));
}

// get the search string from the command line, defaulting to "node.js"
var str = process.argv.length > 2 ? process.argv[2] : "node.js";

// call google to get search results
var result = google(str, _);

// format the result and print it to console
var formatted = result.responseData.results.map( function(entry) {
	return entry.url + '\n\t' + entry.titleNoFormatting;
}).join('\n');
console.log(formatted);
