/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */
"use strict";
//streamline.options = { "tryCatch" : "fast", "lines" : "ignore" }

var urlHelper = require("streamline/lib/util/url");
/// !nodoc -- experimental
/// 
/// # streamline/lib/streams/server/httpHelper
///  
/// HTTP helpers

exports.HttpStatus = {
	OK: 200,
	Created: 201,
	Accepted: 202,
	NoContent: 204,
	MovedPermanently: 301,
	Found: 302,
	SeeOther: 303,
	NotModified: 304,
	TemporaryRedirect: 307,
	BadRequest: 400,
	Unauthorized: 401,
	Forbidden: 403,
	NotFound: 404,
	MethodNotAllowed: 405,
	NotAcceptable: 406,
	Conflict: 409,
	Gone: 410,
	PreconditionFailed: 412,
	UnsupportedMediaType: 415,
	InternalServerError: 500,
	NotImplemented: 501,
	ServiceUnavailable: 503
}

function _classifyMedia(str){
	if (str == "*" || str == "*/*") 
		return "*";
	var lower = str.toLowerCase();
	if (lower.indexOf("xml") >= 0) 
		return "xml";
	if (lower.indexOf("html") >= 0) 
		return "html";
	if (lower.indexOf("json") >= 0) 
		return "json";
	if (lower.indexOf("text") >= 0) 
		return "text";
	if (lower.indexOf("image") >= 0) 
		return "image";
	return "unknown";
}

exports.parseAccept = function(str){
	// parse and sort by decreasing quality
	var accept = (str || "").toString().split(/,\s*/).map(function(part, i){
		var m = part.match(/^([^\s,]+?)(?:;\s*q=(\d+(?:\.\d+)?))?$/)
		return m && [m[1], Number(m[2] || 1.0), i];
	}).filter(function(elt){
		return elt;
	}).sort(function(elt1, elt2){
		return elt2[1] - elt1[1] || elt1[2] - elt2[2]; // 2nd test to preserve order
	}).map(function(elt){
		var split = elt[0].split(';');
		var result = {
			rawType: split[0],
			type: _classifyMedia(split[0]),
			parameters: {}
		};
		split.slice(1).forEach(function(str){
			var pair = str.split(/\s*=\s*/);
			result.parameters[pair[0]] = pair[1];
		});
		return result;
	})
	// empty accept means accept anything
	return accept.length > 0 ? accept : [{
		rawType: "*",
		type: "*",
		parameters: {}
	}];
}

function HttpError(statusCode, message){
	this.statusCode = statusCode;
	this.message = message;
	this.stack = new Error().stack;
}

exports.tracer = null;

exports.HttpContext = function(request, response, options){
	if (request == null) // subclassing
		return;
	options = options || {};
	
	if (exports.tracer) {
		exports.tracer("\nHTTP REQUEST: " + request.method + " " + request.url + "\n");
		exports.tracer("headers: " + JSON.stringify(request.headers) + "\n");
	}
	
	this.request = request;
	this.response = response;
	this.method = (request.headers[options.methodHeader || "x-http-method-override"] || request.method).toLowerCase();
	// URL stuff
	var _split = request.url.split('?');
	this.path = _split.splice(0, 1)[0];
	var _urlBegin = (request.socket.secure ? "https" : "http") + "://" + request.headers.host;
	this.url = _urlBegin + this.path;
	this.rawQuery = _split.join('?');
	this.query = urlHelper.parseQueryString(this.rawQuery);
	var _segments = this.path.split('/').map(function(seg){
		return decodeURIComponent(seg);
	});
	var _segI = 1; // start after leading /
	this.walkUrl = function(){
		return _segments[_segI++];
	}
	this.walked = function(){
		return _urlBegin + _segments.slice(0, _segI).join("/");
	}
	
	// Accept stuff
	this.rawAccept = this.query[options.acceptParam] || request.headers.accept || "*";
	this.accept = exports.parseAccept(this.rawAccept);
	
	// Request body stuff
	this.parseBody = function(_){
		var ct = request.headers["content-type"];
		if (!ct) 
			return null;
		if (ct.indexOf("application/json") !== 0) 
			throw new HttpError(415, "expected application/json, got: " + ct);
		// assume utf8 -- be smarter later
		//request.setEncoding('utf8');
		var str = request.readAll(_);
		if (str == null) 
			return null;
		if (exports.tracer) 
			exports.tracer("body: " + str + "\n")
		return JSON.parse(str);
	}
	
	this.reply = function(code, message, headers){
		headers = headers || {};
		if (message && !headers["content-type"])
			headers["content-type"] = "text/plain";
		response.writeHead(code, headers);
		response.end(message);
	}
	
	this.scratch = {}; // scratch area where business logic can write stuff
}
