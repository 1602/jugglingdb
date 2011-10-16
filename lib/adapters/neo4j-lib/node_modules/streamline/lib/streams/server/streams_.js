/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */
"use strict";
//streamline.options = { "tryCatch" : "fast", "lines" : "ignore" }

/// !doc
/// 
/// # streamline/lib/streams/server/streams
///  
/// Server Streams module
/// 
/// The `streams` module contains _pull mode_ wrappers around node streams.
/// 
/// These wrappers implement a _pull style_ API. 
/// Instead of having the stream _push_ the data to its consumer by emitting `data` and `end` events, 
/// these wrappers let the consumer _pull_ the data from the stream by calling asynchronous `read` methods.
/// 
/// For a bit more background on this design,
/// you can read [this blog post](http://bjouhier.wordpress.com/2011/04/25/asynchronous-episode-3-adventures-in-event-land/)
/// 
/// For a simple example of this API in action, 
/// see the [google client example](./examples/googleClient_.js)

var parseUrl = require("url").parse;

function _reply(callback, err, value) {
	try {
		callback(err, value);
	} catch (ex) {
		__propagate(callback, ex);
	}
}

function checkOpen(emitter) {
	if (!emitter)
		throw new Error("invalid operation on closed stream")
}

function wrapProperties(constr, writable, props) {
	props.forEach( function(name) {
		constr.prototype.__defineGetter__(name, function() {
			return this.emitter[name];
		})
	});
	writable && props.forEach( function(name) {
		constr.prototype.__defineSetter__(name, function(val) {
			this.emitter[name] = val;
			return this;
		})
	});
}

function wrapMethods(constr, methods) {
	methods.forEach( function(name) {
		constr.prototype[name] = function() {
			return this.emitter[name].apply(this.emitter, arguments);
		}
	});
}

function wrapChainMethods(constr, methods) {
	methods.forEach( function(name) {
		constr.prototype[name] = function() {
			this.emitter[name].apply(this.emitter, arguments);
			return this;
		}
	});
}

function wrapEvents(constr, events) {
	constr.prototype.events = (constr.prototype.events || []).concat(events);
}

/// 
/// ## Emitter
/// 
/// Base wrapper for all objects that emit an `end` or `close` event.  
/// All stream wrappers derive from this wrapper.
/// 
/// * `wrapper = new streams.Emitter(stream)`  
///   creates a wrapper.
function Emitter(emitter) {
	emitter.on('close', function() {
		_onClose();
	});
	function trackClose() {
		emitter = null;
	}

	var _onClose = trackClose;

	this.close = function(callback) {
		if (!callback)
			return __future.call(this, this.close, arguments, 0);
		if (!emitter)
			return _reply(callback);
		var close = emitter.close || emitter.destroySoon;
		if (typeof close !== "function")
			return _reply(callback);
		_onClose = function() {
			emitter = null;
			_onClose = trackClose;
			_reply(callback);
		}
		if (this.doesNotEmitClose)
			emitter.emit("close");
		close.call(emitter);
	}
	/// * `emitter = wrapper.emitter`  
	///    returns the underlying emitter. The emitter stream can be used to attach additional observers.
	this.__defineGetter__("emitter", function() {
		return emitter;
	})
	/// * `emitter = wrapper.unwrap()`  
	///    unwraps and returns the underlying emitter.  
	///    The wrapper should not be used after this call.
	this.unwrap = function() {
		var result = emitter;
		emitter && emitter.events.forEach( function(event) {
			emitter.removeAllListeners(event);
		});
		emitter = null;
		return result;
	}
}

/// 
/// ## ReadableStream
/// 
/// All readable stream wrappers derive from this wrapper. 
/// 
/// * `stream = new streams.ReadableStream(stream, [options])`  
///   creates a readable stream wrapper.
function ReadableStream(emitter, options) {
	Emitter.call(this, emitter);
	options = options || {}
	var _low = Math.max(options.lowMark || 0, 0);
	var _high = Math.max(options.highMark || 0, _low);
	var _paused = false;
	var _current = 0;
	var _chunks = [];
	var _error;
	var _done = false;
	var _encoding;

	emitter.on('error', function(err) {
		_onData(err);
	});
	emitter.on('data', function(chunk) {
		_onData(null, chunk);
	});
	emitter.on('end', function() {
		_onData(null, null);
	});
	function trackData(err, chunk) {
		if (!emitter)
			return;
		if (err)
			_error = err;
		else if (chunk) {
			_chunks.push(chunk);
			_current += chunk.length;
			if (_current > _high && !_paused && !_done && !_error) {
				emitter.pause();
				_paused = true;
			}
		} else
			_done = true;
	};

	var _onData = trackData;

	function readChunk(callback) {
		if (_chunks.length > 0) {
			var chunk = _chunks.splice(0, 1)[0];
			_current -= chunk.length;
			if (_current <= _low && _paused && !_done && !_error) {
				emitter.resume();
				_paused = false;
			}
			return _reply(callback, null, chunk);
		} else if (_done)
			return _reply(callback, null, null);
		else if (_error)
			return _reply(callback, _error);
		else
			_onData = function(err, chunk) {
				if (err)
					_error = err;
				else if (!chunk)
					_done = true;
				_onData = trackData; // restore it
				_reply(callback, err, chunk);
			};
	}

	function concat(chunks, total) {
		if (_encoding)
			return chunks.join('');
		if (chunks.length == 1)
			return chunks[0];
		var result = new Buffer(total);
		chunks.reduce( function(val, chunk) {
			chunk.copy(result, val);
			return val + chunk.length;
		}, 0);
		return result;
	}
	/// * `stream.setEncoding(enc)`  
	///   sets the encoding.
	///   returns `this` for chaining.
	this.setEncoding = function(enc) {
		checkOpen(emitter);
		_encoding = enc;
		if (enc)
			emitter.setEncoding(enc);
		return this;
	}
	/// * `data = stream.read(_, [len])`  
	///   reads asynchronously from the stream and returns a `string` or a `Buffer` depending on the encoding.  
	///   If a `len` argument is passed, the `read` call returns when `len` characters or bytes 
	///   (depending on encoding) have been read, or when the underlying stream has emitted its `end` event.  
	///   Without `len`, the read calls returns the data chunks as they have been emitted by the underlying stream.  
	///   Once the end of stream has been reached, the `read` call returns `null`.
	this.read = function(_, len) {
		if (!emitter)
			return null;
		if (len == null)
			return readChunk(_);
		if (len < 0)
			len = Infinity;
		if (len == 0)
			return _encoding ? "" : new Buffer(0);
		var chunks = [], total = 0;
		while (total < len) {
			var chunk = readChunk(_);
			if (!chunk)
				return chunks.length == 0 ? null : concat(chunks, total);
			if (total + chunk.length <= len) {
				chunks.push(chunk);
				total += chunk.length;
			} else {
				chunks.push(chunk.slice(0, len - total));
				this.unread(chunk.slice(len - total));
				total = len;
			}
		}
		return concat(chunks, total);
	}
	/// * `data = stream.readAll(_)`  
	///   reads till the end of stream.  
	///   Equivalent to `stream.read(_, -1)`.
	this.readAll = function(_) {
		return this.read(_, -1);
	}
	/// * `stream.unread(chunk)`  
	///   pushes the chunk back to the stream.  
	///   returns `this` for chaining.
	this.unread = function(chunk) {
		if (chunk) {
			_chunks.splice(0, 0, chunk);
			_current += chunk.length;
		}
		return this;
	}
}

exports.ReadableStream = ReadableStream;
wrapEvents(ReadableStream, ["error", "data", "end", "close"]);

/// 
/// ## WritableStream
/// 
/// All writable stream wrappers derive from this wrapper. 
/// 
/// * `stream = new streams.WritableStream(stream, [options])`  
///   creates a writable stream wrapper.
function WritableStream(emitter, options) {
	Emitter.call(this, emitter);
	options = options || {}
	var _drainCallback;

	emitter.on('drain', function() {
		var callback = _drainCallback;
		if (callback) {
			_drainCallback = null;
			_reply(callback);
		}
	})
	function _drain(callback) {
		_drainCallback = callback;
	}

	/// * `stream.write(_, data, [enc])`  
	///   Writes the data.  
	///   This operation is asynchronous because it _drains_ the stream if necessary.  
	///   If you have a lot of small write operations to perform and you don't want the overhead of draining at every step, 
	///   you can write to the underlying stream with `stream.emitter.write(data)` most of the time 
	///   and call `stream.write(_, data)` once in a while to drain.  
	///   Returns `this` for chaining.
	this.write = function(_, data, enc) {
		checkOpen(emitter);
		if (!emitter.write(data, enc))
			_drain(_);
		return this;
	}
	/// * `stream.end()`  
	///   signals the end of the send operation.  
	///   Returns `this` for chaining.
	this.end = function(data, enc) {
		checkOpen(emitter);
		emitter.end(data, enc);
		return this;
	}
}

exports.WritableStream = WritableStream;
wrapEvents(WritableStream, ["drain", "close"]);

function _getEncoding(headers) {
	var comps = (headers['content-type'] || 'text/plain').split(';');
	var ctype = comps[0];
	for (var i = 1; i < comps.length; i++) {
		var pair = comps[i].split('=');
		if (pair.length == 2 && pair[0].trim() == 'charset')
			return pair[1].trim();
	}
	if (ctype.indexOf('text') >= 0 || ctype.indexOf('json') >= 0)
		return "utf8";
	return null;
}

/// 
/// ## HttpServerRequest
/// 
/// This is a wrapper around node's `http.ServerRequest`:
/// This stream is readable (see Readable Stream above).
/// 
/// * `request = new streams.HttpServerRequest(req, [options])`  
///    returns a wrapper around `req`, an `http.ServerRequest` object.   
///    The `options` parameter can be used to pass `lowMark` and `highMark` values.
function HttpServerRequest(req, options) {
	ReadableStream.call(this, req, options);
	this._request = req;
	this.setEncoding(_getEncoding(req.headers));
}

exports.HttpServerRequest = HttpServerRequest;
HttpServerRequest.prototype.doesNotEmitClose = true;

/// * `method = request.method` 
/// * `url = request.url` 
/// * `headers = request.headers` 
/// * `trailers = request.trailers` 
/// * `httpVersion = request.httpVersion` 
/// * `connection = request.connection` 
/// * `socket = request.socket`  
///   (same as `http.ServerRequest`)
// TODO: all properties may not be writable - check
wrapProperties(HttpServerRequest, true, ["method", "url", "headers", "trailers", "httpVersion", "connection", "socket"]);

/// 
/// ## HttmServerResponse
/// 
/// This is a wrapper around node's `http.ServerResponse`.  
/// This stream is writable (see Writable Stream above).
/// 
/// * `response = new streams.HttpServerResponse(resp, [options])`  
///   returns a wrapper around `resp`, an `http.ServerResponse` object.
function HttpServerResponse(resp, options) {
	WritableStream.call(this, resp, options);
	this._response = resp;
}

exports.HttpServerResponse = HttpServerResponse;
HttpServerResponse.prototype.doesNotEmitClose = true;

/// * `response.writeContinue()` 
/// * `response.writeHead(head)` 
/// * `response.setHeader(name, value)` 
/// * `value = response.getHeader(head)` 
/// * `response.removeHeader(name)` 
/// * `response.addTrailers(trailers)` 
/// * `response.statusCode = value`  
///   (same as `http.ServerResponse`)
wrapChainMethods(HttpServerResponse, ["writeContinue", "writeHead", "setHeader", "removeHeader", "addTrailers"]);
wrapMethods(HttpServerResponse, ["getHeader"]);
wrapProperties(HttpServerResponse, true, ["statusCode"]);

function _fixHttpServerOptions(options) {
	options = options || {};
	options.module = require(options.secure ? "https" : "http");
	return options;
}

/// 
/// ## HttpServer
/// 
/// This is a wrapper around node's `http.Server` object:
/// 
/// * `server = new streams.HttpServer(requestListener, [options])`    
///   creates the wrapper.  
///   `requestListener` is called as `requestListener(request, response, _)` 
///   where `request` and `response` are wrappers around `http.ServerRequest` and `http.ServerResponse`.
function HttpServer(requestListener, options) {
	var self = this;
	options = _fixHttpServerOptions(options);
	var server = options.module.createServer( function(request, response) {
		return requestListener(new HttpServerRequest(request, options), new HttpServerResponse(response, options), function(err) {
			if (err) {
				response.writeHead(500, { "Content-Type" : "text/plain" });
				response.end(err.message + "\n" + err.stack);	
			}
		});
	});
	Emitter.call(this, server);

	/// * `server.listen(_, port, [host])`
	/// * `server.listen(_, path)`  
	///   (same as `http.Server`)
	this.listen = function(callback, args) {
		if (!callback)
			return __future.call(this, this.listen, arguments, 0);
		args = Array.prototype.slice.call(arguments, 1);
		args.push( function() {
			_reply(callback, null, self);
		});
		server.listen.apply(server, args)
	}
}

exports.HttpServer = HttpServer;

/// 
/// ## HttpClientResponse
/// 
/// This is a wrapper around node's `http.ClientResponse`
/// 
/// This stream is readable (see Readable Stream above).
/// 
/// * `response = request.response(_)` returns the response stream.
function HttpClientResponse(resp, options) {
	ReadableStream.call(this, resp, options);
	this._response = resp;
	this.setEncoding(_getEncoding(resp.headers));
}

/// * `status = response.statusCode`  
///    returns the HTTP status code.
/// * `version = response.httpVersion`  
///    returns the HTTP version.
/// * `headers = response.headers`  
///    returns the HTTP response headers.
/// * `trailers = response.trailers`  
///    returns the HTTP response trailers.
wrapProperties(HttpClientResponse, false, ["statusCode", "httpVersion", "headers", "trailers"]);

/// * `response.checkStatus(statuses)`  
///    throws an error if the status is not in the `statuses` array.  
///    If only one status is expected, it may be passed directly as an integer rather than as an array.  
///    Returns `this` for chaining.
HttpClientResponse.prototype.checkStatus = function(statuses) {
	if (typeof statuses === 'number')
		statuses = [statuses];
	if (statuses.indexOf(this.statusCode) < 0)
		throw new Error("invalid status: " + this.statusCode);
	return this;
}

function _fixHttpClientOptions(options) {
	if (!options)
		throw new Error("request error: no options");
	if (typeof options === "string")
		options = { url: options };
	if (options.url) {
		var parsed = parseUrl(options.url);
		options.protocol = parsed.protocol;
		options.host = parsed.hostname;
		options.port = parsed.port;
		options.path = parsed.pathname + (parsed.query ? "?" + parsed.query : "");
	}
	options.protocol = options.protocol || "http:";
	options.port = options.port || (options.protocol === "https:" ? 443 : 80);
	options.path = options.path || "/";
	if (!options.host)
		throw new Error("request error: no host");
	options.method = options.method  || "GET";
	options.headers = options.headers || {};
	options.module = require(options.protocol.substring(0, options.protocol.length - 1));
	if (options.user != null) {
		// assumes basic auth for now
		var token = options.user + ":" + (options.password || "");
		token = new Buffer(token, "utf8").toString("base64");
		options.headers.Authorization = "Basic " + token;
	}

	if (options.proxy) {
		if (typeof options.proxy === "string") {
			options.proxy = parseUrl(options.proxy);
			options.proxy.host = options.proxy.hostname;
		}
		options.proxy.port = options.proxy.port || options.port;
		if (!options.proxy.host)
			throw new Error("proxy configuration error: no host");
		options.path = options.protocol + "//" + options.host + ":" + options.port + options.path;
		options.headers.host = options.host;
		options.host = options.proxy.host;
		options.port = options.proxy.port;
		// will worry about authenticated proxy later
	}
	return options;
}

/// 
/// ## HttpClientRequest
/// 
/// This is a wrapper around node's `http.ClientRequest`.
/// 
/// This stream is writable (see Writable Stream above).
/// 
/// * `request = streams.httpRequest(options)`  
///    creates the wrapper.  
///    The options are the following:
///    * `method`: the HTTP method, `'GET'` by default.
///    * `headers`: the HTTP headers.
///    * `url`: the requested URL (with query string if necessary).
///    * `proxy.url`: the proxy URL.
///    * `lowMark` and `highMark`: low and high water mark values for buffering (in bytes or characters depending
///      on encoding).  
///      Note that these values are only hints as the data is received in chunks.
function HttpClientRequest(options) {
	options = _fixHttpClientOptions(options);
	var _request = options.module.request(options, function(resp) {
		_onResponse(null, resp && new HttpClientResponse(resp, options));
	});
	WritableStream.call(this, _request, options);
	var _response;
	var _error;
	var _done = false;

	_request.on('error', function(err) {
		// TODO: add context to error
		!_response && _onResponse(err);
	});
	function trackResponse(err, resp) {
		_done = true;
		_error = err;
		_response =  resp;
	};

	var _onResponse = trackResponse;
	/// * `response = request.response(_)`  
	///    returns the response. 
	this.response = function(callback) {
		if (!callback)
			return __future.call(this, this.response, arguments, 0);
		if (_done)
			return _reply(callback, _error,  _response);
		else
			_onResponse = function(err, resp) {
				_reply(callback, err, resp);
			};
	}
}

/// * `request.abort()`  
///    aborts the request. 
wrapChainMethods(HttpClientRequest, ["abort"]);

exports.httpRequest = function(options) {
	return new HttpClientRequest(options);
};

/// 
/// ## NetStream
/// 
/// This is a wrapper around streams returned by TCP and socket clients:
/// 
/// These streams is both readable and writable (see Readable Stream and Writable Stream above).
/// 
/// * `stream = new streams.NetStream(stream, [options])`  
///   creates a network stream wrapper.

function NetStream(emitter, options) {
	ReadableStream.call(this, emitter, options.read || options);
	WritableStream.call(this, emitter, options.write || options);
}

exports.NetStream = NetStream;

var net; // lazy require

/// 
/// ## TCP and Socket clients
/// 
/// These are wrappers around node's `net.createConnection`:
/// 
/// * `client = streams.tcpClient(port, host, [options])`  
///    returns a TCP connection client.
/// * `client = streams.socketClient(path, [options])`  
///    returns a socket client.  
///   The `options` parameter of the constructor provide options for the stream (`lowMark` and `highMark`). If you want different options for `read` and `write` operations, you can specify them by creating `options.read` and `options.write` sub-objects inside `options`.
exports.tcpClient = function(port, host, options) {
	host = host || "localhost";
	options = options || {};
	return new NetClient(options, port, host);
}
exports.socketClient = function(path, options) {
	options = options || {};
	return new NetClient(options, path);
}

function NetClient(options, args) {
	args = Array.prototype.slice.call(arguments, 1);
	net = net || require("net");
	var _connection = net.createConnection.apply(net, args);
	var _error;
	var _done = false;

	_connection.on('error', function(err) {
		// TODO: add context to error
		_onConnect(err);
	});
	_connection.on('connect', function() {
		_onConnect(null);
	});
	function trackConnect(err) {
		_done = true;
		_error = err;
	};

	var _onConnect = trackConnect;

	/// * `stream = client.connect(_)`  
	///    connects the client and returns a network stream.
	this.connect = function(callback) {
		if (!callback)
			return __future.call(this, this.connect, arguments, 0);
		if (_done)
			return _reply(callback, _error, new NetStream(_connection, options));
		else
			_onConnect = function(err) {
				_reply(callback, err, new NetStream(_connection, options));
			};
	}
}
