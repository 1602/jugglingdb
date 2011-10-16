"use strict";
//streamline.options = { "tryCatch" : "fast", "lines" : "ignore" }
/// !doc
/// 
/// # streamline/lib/require/server/require
///  
/// Server-side require handler
/// 
/// Handles require requests coming from the client.
/// 
var fs = require('fs');
var depend = require("./depend");
var flows = require('streamline/lib/util/flows');
var uuid = require('streamline/lib/util/uuid');
var each = flows.each;
var path = require('path');
var url = require('streamline/lib/util/url');

function _replyError(response, statusCode, body) {
	response.writeHead(statusCode, {
		'Content-Type': 'text/plain',
		'Content-Length': body.length
	});
	response.end(body);
}

// request is a GET on /require/module_path?known=known_modules
// response is a multipart document containing the requested module script
// and all its dependencies that are not referenced by any of the known modules.

/// * `dispatcher = require.dispatcher(options)`  
///   returns an HTTP request dispatcher that responds to requests
///   issued by the client-side `require` script.  
///   The dispatcher is called as `dispatcher(_, request, response)`
exports.dispatcher = function(config) {
	config = config || {};
	// default root is lib sibling of ancestor node_modules
	var root = config.root || path.join(__dirname, "../../../../..");
	return function(_, request, response) {
		try {
			var noneMatch = request.headers['if-none-match'];
			if (noneMatch === depend.etag()) {
				response.writeHead(304, {});
				return response.end();
			}
			var parts = request.url.split('?');
			var qs = url.parseQueryString(parts[1]);
			var path = qs["module"];
			var known = (qs["known"] || "").split(",");

			if (path[0] == '.')
				throw new Error("server require cannot resolve relative path: " + path);
			path = path[0] == '/' ? root + path : root + "/node_modules/" + path;
			var stats = fs.stat(path + ".js", _);
			if (!stats.isFile())
				return _replyError(response, 404, "file not found " + path);

			var missing = depend.missingDependencies(_, path, known);
			var accept = request.headers.accept;
			if (accept.indexOf('text/html') == 0) {
				response.writeHead(200, {
					'content-type': 'text/html',
					'ETag': depend.etag()
				});
				response.write(_, "<html>"
				+ "\n<head><title>dependencies: " + path
				+ "</title></head>" + "\n<body><ul>"
				+ missing.sort().map( function(dep) {
					dep = dep.substring(root.length + 1);
					return '\n<li><a href="/require/' + dep + '">' + dep + '</li>';
				}).join('')
				+ "\n</ul>"
				+ "\n</body>\n</html>");
				response.end();
				return;
			}

			var boundary = uuid.generate();
			var endMarker = "\n--" + boundary + "--\n";
			response.writeHead(200, {
				'Content-Type': 'multipart/related; boundary="' + boundary + '"',
				'ETag': depend.etag()
			});
			var i = 0;
			each(_, missing, function(_, dep) {
				try {
					var modIndex = dep.indexOf("/node_modules/");
					var location = modIndex >= 0 ? dep.substring(modIndex + 14) : dep.substring(root.length);
					var data = fs.readFile(dep + ".js", "utf8", _);
					response.write(_, "\n--" + boundary + "\n"
					+ "Content-ID: FILE " + ++i + "\n"
					+ "Content-Location: " + location + "\n"
					+ "Content-Type: application/javascript\n"
					+ "\n" + data + "\n");
				} catch (ex) {
					response.write(_, "\n--" + boundary + "\n"
					+ "Content-ID: ERROR\n"
					+ "Content-Type: text/plain\n"
					+ "\n" + ex.toString() + "\n");
					response.end(endMarker);
				}
			});
			response.end(endMarker);
		} catch (ex) {
			console.error(ex.message + "\n" + ex.stack);
			return _replyError(response, 500, ex.toString());
		}
	};
}
