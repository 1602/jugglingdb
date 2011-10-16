
# streamline/lib/compiler/command
 
Streamline commmand line analyzer / dispatcher

* `command.run()`  
  runs `node-streamline` command line analyzer / dispatcher

# streamline/lib/compiler/compile
 
Streamline compiler and file loader

* `script = compile.loadFile(_, path, options)`  
  Loads Javascript file and transforms it if necessary.  
  Returns the transformed source.  
  If `path` is `foo_.js`, the source is transformed and the result
  is *not* saved to disk.  
  If `path` is `foo.js` and if a `foo_.js` file exists,
  `foo_.js` is transformed if necessary and saved as `foo.js`.  
  If `path` is `foo.js` and `foo_.js` does not exist, the contents
  of `foo.js` is returned.  
  `options` is a set of options passed to the transformation engine.  
  If `options.force` is set, `foo_.js` is transformed even if 
  `foo.js` is more recent.
* `script = compile.loadFileSync(path, options)`  
  Synchronous version of `compile.loadFile`.  
  Used by `require` logic.
* `compile.compile(_, paths, options)`  
  Compiles streamline source files in `paths`.  
  Generates a `foo.js` file for each `foo_.js` file found in `paths`.
  `paths` may be a list of files or a list of directories which
  will be traversed recursively.  
  `options`  is a set of options for the `transform` operation.

# streamline/lib/compiler/register
 
Streamline `require` handler registration

* `register.register(options)`  
  Registers `require` handlers for streamline.  
  `options` is a set of default options passed to the `transform` function.

# streamline/lib/compiler/transform
 
Streamline's transformation engine

* `transformed = transform.transform(source, options)`  
  Transforms streamline source.  
  The following `options` may be specified:
  * `tryCatch` controls exception handling
  * `lines` controls line mapping
  * `callback` alternative identifier if `_` is already used.
  * `noHelpers` disables generation of helper functions (`__cb`, etc.)

# streamline/lib/require/client/require
 
Client-side require script

* `id = module.id`  
  the `id` of the current module.
* `module = require(id)`  
  _requires_ a module synchronously.  
  `id` _must_ be a string literal.
* `module = require.async(id, _)`  
  _requires_ a module asynchronously.  
  `id` may be a variable or an expression.
* `main = require.main`  
  return the main module
* `require.main(id)`  
  loads main module from HTML page.

# streamline/lib/require/server/require
 
Server-side require handler

Handles require requests coming from the client.

* `dispatcher = require.dispatcher(options)`  
  returns an HTTP request dispatcher that responds to requests
  issued by the client-side `require` script.  
  The dispatcher is called as `dispatcher(_, request, response)`

# streamline/lib/streams/server/streams
 
Server Streams module

The `streams` module contains _pull mode_ wrappers around node streams.

These wrappers implement a _pull style_ API. 
Instead of having the stream _push_ the data to its consumer by emitting `data` and `end` events, 
these wrappers let the consumer _pull_ the data from the stream by calling asynchronous `read` methods.

For a bit more background on this design,
you can read [this blog post](http://bjouhier.wordpress.com/2011/04/25/asynchronous-episode-3-adventures-in-event-land/)

For a simple example of this API in action, 
see the [google client example](./examples/googleClient_.js)

## Emitter

Base wrapper for all objects that emit an `end` or `close` event.  
All stream wrappers derive from this wrapper.

* `wrapper = new streams.Emitter(stream)`  
  creates a wrapper.
* `emitter = wrapper.emitter`  
   returns the underlying emitter. The emitter stream can be used to attach additional observers.
* `emitter = wrapper.unwrap()`  
   unwraps and returns the underlying emitter.  
   The wrapper should not be used after this call.

## ReadableStream

All readable stream wrappers derive from this wrapper. 

* `stream = new streams.ReadableStream(stream, [options])`  
  creates a readable stream wrapper.
* `stream.setEncoding(enc)`  
  sets the encoding.
  returns `this` for chaining.
* `data = stream.read(_, [len])`  
  reads asynchronously from the stream and returns a `string` or a `Buffer` depending on the encoding.  
  If a `len` argument is passed, the `read` call returns when `len` characters or bytes 
  (depending on encoding) have been read, or when the underlying stream has emitted its `end` event.  
  Without `len`, the read calls returns the data chunks as they have been emitted by the underlying stream.  
  Once the end of stream has been reached, the `read` call returns `null`.
* `data = stream.readAll(_)`  
  reads till the end of stream.  
  Equivalent to `stream.read(_, -1)`.
* `stream.unread(chunk)`  
  pushes the chunk back to the stream.  
  returns `this` for chaining.

## WritableStream

All writable stream wrappers derive from this wrapper. 

* `stream = new streams.WritableStream(stream, [options])`  
  creates a writable stream wrapper.
* `stream.write(_, data, [enc])`  
  Writes the data.  
  This operation is asynchronous because it _drains_ the stream if necessary.  
  If you have a lot of small write operations to perform and you don't want the overhead of draining at every step, 
  you can write to the underlying stream with `stream.emitter.write(data)` most of the time 
  and call `stream.write(_, data)` once in a while to drain.  
  Returns `this` for chaining.
* `stream.end()`  
  signals the end of the send operation.  
  Returns `this` for chaining.

## HttpServerRequest

This is a wrapper around node's `http.ServerRequest`:
This stream is readable (see Readable Stream above).

* `request = new streams.HttpServerRequest(req, [options])`  
   returns a wrapper around `req`, an `http.ServerRequest` object.   
   The `options` parameter can be used to pass `lowMark` and `highMark` values.
* `method = request.method` 
* `url = request.url` 
* `headers = request.headers` 
* `trailers = request.trailers` 
* `httpVersion = request.httpVersion` 
* `connection = request.connection` 
* `socket = request.socket`  
  (same as `http.ServerRequest`)

## HttmServerResponse

This is a wrapper around node's `http.ServerResponse`.  
This stream is writable (see Writable Stream above).

* `response = new streams.HttpServerResponse(resp, [options])`  
  returns a wrapper around `resp`, an `http.ServerResponse` object.
* `response.writeContinue()` 
* `response.writeHead(head)` 
* `response.setHeader(name, value)` 
* `value = response.getHeader(head)` 
* `response.removeHeader(name)` 
* `response.addTrailers(trailers)` 
* `response.statusCode = value`  
  (same as `http.ServerResponse`)

## HttpServer

This is a wrapper around node's `http.Server` object:

* `server = new streams.HttpServer(requestListener, [options])`    
  creates the wrapper.  
  `requestListener` is called as `requestListener(request, response, _)` 
  where `request` and `response` are wrappers around `http.ServerRequest` and `http.ServerResponse`.
* `server.listen(_, port, [host])`
* `server.listen(_, path)`  
  (same as `http.Server`)

## HttpClientResponse

This is a wrapper around node's `http.ClientResponse`

This stream is readable (see Readable Stream above).

* `response = request.response(_)` returns the response stream.
* `status = response.statusCode`  
   returns the HTTP status code.
* `version = response.httpVersion`  
   returns the HTTP version.
* `headers = response.headers`  
   returns the HTTP response headers.
* `trailers = response.trailers`  
   returns the HTTP response trailers.
* `response.checkStatus(statuses)`  
   throws an error if the status is not in the `statuses` array.  
   If only one status is expected, it may be passed directly as an integer rather than as an array.  
   Returns `this` for chaining.

## HttpClientRequest

This is a wrapper around node's `http.ClientRequest`.

This stream is writable (see Writable Stream above).

* `request = streams.httpRequest(options)`  
   creates the wrapper.  
   The options are the following:
   * `method`: the HTTP method, `'GET'` by default.
   * `headers`: the HTTP headers.
   * `url`: the requested URL (with query string if necessary).
   * `proxy.url`: the proxy URL.
   * `lowMark` and `highMark`: low and high water mark values for buffering (in bytes or characters depending
     on encoding).  
     Note that these values are only hints as the data is received in chunks.
* `response = request.response(_)`  
   returns the response. 
* `request.abort()`  
   aborts the request. 

## NetStream

This is a wrapper around streams returned by TCP and socket clients:

These streams is both readable and writable (see Readable Stream and Writable Stream above).

* `stream = new streams.NetStream(stream, [options])`  
  creates a network stream wrapper.

## TCP and Socket clients

These are wrappers around node's `net.createConnection`:

* `client = streams.tcpClient(port, host, [options])`  
   returns a TCP connection client.
* `client = streams.socketClient(path, [options])`  
   returns a socket client.  
  The `options` parameter of the constructor provide options for the stream (`lowMark` and `highMark`). If you want different options for `read` and `write` operations, you can specify them by creating `options.read` and `options.write` sub-objects inside `options`.
* `stream = client.connect(_)`  
   connects the client and returns a network stream.
# streamline/lib/tools/docTool
 
Documentation tool

Usage:

     node streamline/lib/tools/docTool [path]

Extracts documentation comments from `.js` files and generates `API.md` file 
under package root.

Top of source file must contain `/// !doc` marker to enable doc extraction.  
Documentation comments must start with `/// ` (with 1 trailing space).  
Extraction can be turned off with `/// !nodoc` and turned back on with `/// !doc`.

The tool can also be invoked programatically with:

* `doc = docTool.generate(_, path)`
  extracts documentation comments from file `path`

# streamline/lib/util/flows
 
Flows Module

The `streamline/lib/util/flows` module contains some handy utilities for streamline code

## Array utilities

The following functions are async equivalents of the ES5 Array methods (`forEach`, `map`, `filter`, ...)

* `flows.each(_, array, fn, [thisObj])`  
  applies `fn` sequentially to the elements of `array`.  
  `fn` is called as `fn(_, elt, i)`.
* `result = flows.map(_, array, fn, [thisObj])`  
  transforms `array` by applying `fn` to each element in turn.  
  `fn` is called as `fn(_, elt, i)`.
* `result = flows.filter(_, array, fn, [thisObj])`  
  generates a new array that only contains the elements that satisfy the `fn` predicate.  
  `fn` is called as `fn(_, elt)`.
* `bool = flows.every(_, array, fn, [thisObj])`  
  returns true if `fn` is true on every element (if `array` is empty too).  
  `fn` is called as `fn(_, elt)`.
* `bool = flows.some(_, array, fn, [thisObj])`  
  returns true if `fn` is true for at least one element.  
  `fn` is called as `fn(_, elt)`.
* `result = flows.reduce(_, array, fn, val, [thisObj])`  
  reduces by applying `fn` to each element.  
  `fn` is called as `val = fn(_, val, elt, i, array)`.
* `result = flows.reduceRight(_, array, fn, val, [thisObj])`  
  reduces from end to start by applying `fn` to each element.  
  `fn` is called as `val = fn(_, val, elt, i, array)`.

## Object utility

The following function can be used to iterate through object properties:

* `flows.eachKey(_, obj, fn)`  
  calls `fn(_, key, obj[key])` for every `key` in `obj`.

## Workflow Utilities

* `fun = flows.funnel(max)`  
  limits the number of concurrent executions of a given code block.

The `funnel` function is typically used with the following pattern:

    // somewhere
    var myFunnel = flows.funnel(10); // create a funnel that only allows 10 concurrent executions.
    
    // elsewhere
    myFunnel(_, function(_) { /* code with at most 10 concurrent executions */ });

The `diskUsage2.js` example demonstrates how these calls can be combined to control concurrent execution.

The `funnel` function can also be used to implement critical sections. Just set funnel's `max` parameter to 1.

* `results = flows.collect(_, futures)`  
  collects the results of an array of futures

## Context propagation

Streamline also allows you to propagate a global context along a chain of calls and callbacks.
This context can be used like TLS (Thread Local Storage) in a threaded environment.
It allows you to have several active chains that each have their own global context.

This kind of context is very handy to store information that all calls should be able to access
but that you don't want to pass explicitly via function parameters. The most obvious example is
the `locale` that each request may set differently and that your low level libraries should
be able to retrieve to format messages.

The `streamline.flows` module exposes two functions to manipulate the context:

* `oldCtx = flows.setContext(ctx)`  
  sets the context (and returns the old context).
* `ctx = flows.getContext()`  
  returns the current context.

## Miscellaneous

* `flows.nextTick(_)`  
  `nextTick` function for both browser and server.  
  Aliased to `process.nextTick` on the server side.
* `result = flows.apply(_, fn, thisObj, args, [index])`  
  Helper to apply `Function.apply` to streamline functions.  
  Equivalent to `result = fn.apply(thisObj, argsWith_)` where `argsWith_` is 
  a modified argument list in which the callback has been inserted at `index` 
  (at the end of the argument list if `index` is not specified).
