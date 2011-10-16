//streamline.options = { "lines" : "preserve" }
"use strict";
var streams = require('streamline/lib/streams/streams');
var module = QUnit.module;

var bufSize = 100;
var bufCount = 3;
var totalSize = bufCount * bufSize;
var modulo = 17;

function makeBuffer(i) {
	var buf = new Buffer(bufSize);
	for (var j = 0; j < bufSize; j++)
		buf[j] = 0x30 + i + (j % modulo);
	//console.error("\nGEN: " + i + ": " + buf)
	return buf;
}

function checkBuffer(buf, start) {
	ok(buf != null, "buffer not null");
	var i = Math.floor(start / bufSize);
	var j = start % bufSize;
	for (var k = 0; k < buf.length; k++, j++) {
		if (j == bufSize) {
			i++;
			j = 0;
		}
		if (buf[k] !== 0x30 + i + (j % modulo))
			return ok(false, "buffer verification failed:  i=" + i + ", j=" + j + " k=" + k + " val=" + buf[k]);
	}
	ok(true, "buffer content is valid")
	return start + buf.length;
}

new streams.HttpServer( function (req, res, _) {
	res.writeHead(200, {'Content-Type': 'application/octet-stream'});
	res.emitter.on("drain", function() {
		process.stderr.write("*");
	})
	for (var i = 0; i < bufCount; i++) {
		res.write(_, makeBuffer(i));
		process.nextTick(_);
	}
	res.end();
}).listen(null, 1337, "127.0.0.1");
//console.error('Server running at http://127.0.0.1:1337/');

var paused = 0, resumed = 0;
var doStop = false;

module("node streams test", {
	setup: function() {
	},
	teardown: function() {
		if (doStop) {
			//syracuse.server.close();
			setTimeout( function() {
				process.kill(process.pid);
			}, 0)
		}
	}
});

function addBufferHooks(stream) {
	var pause = stream.pause.bind(stream);
	stream.pause = function() {
		//process.stderr.write("<");
		paused++;
		pause();
	}
	var resume = stream.resume.bind(stream);
	stream.resume = function() {
		//process.stderr.write(">");
		resumed++;
		resume();
	}
}

function doTest(_, name, options, fn) {
	//process.stderr.write("\ttesting " + name);
	options.url = 'http://127.0.0.1:1337/';
	var resp =  streams.httpRequest(options).end().response(_);
	addBufferHooks(resp.emitter);
	fn(_, resp);
	var last = resp.read(_);
	strictEqual(last, null, "read return null at end")
	//console.error(" ok");
}

function dot(_) {
	process.nextTick(_);
	//process.stderr.write(".");

}

function testPass(name, options) {
	//console.error("pass " + name);
	var t0 = Date.now();

	function testRead(name, detail, size) {
		asyncTest(name + " / " + detail, function(_) {
			doTest(_, name, options, function(_, resp) {
				for (var i = 0, total = 0; total < totalSize; i++) {
					var len = size && typeof size === "function" ? size() : size;
					var buf = resp.read(_, len);
					total = checkBuffer(buf, total);
					//dot(_);
				}
			});
			start();
		});
	}

	testRead(name, "chunk read");
	testRead(name, "half size read", Math.floor(bufSize / 2));
	testRead(name, "double size read", bufSize * 2);
	testRead(name, "odd size read", Math.floor(4 * bufSize / 7));
	false && testRead(name, "random size read", function() {
		var r = Math.random();
		return Math.floor(r * r * r * r * 3 * bufSize);
	});
	//console.error("pass completed in " + (Date.now() - t0) + " ms");
}

var oneTenth = Math.floor(bufCount * bufSize / 10);
//testPass("default buffering (warm up)", {});
testPass("default buffering", {});
testPass("buffer 0/1 tenth", { lowMark: 0, highMark: oneTenth });
testPass("buffer 2/3 tenth", { lowMark: 2 * oneTenth, highMark: 3 * oneTenth });
testPass("buffer 1 tenth and above", { lowMark: oneTenth, highMark: 11 * oneTenth });
testPass("buffer all", { lowMark: 0, highMark: 11 * oneTenth });

asyncTest("stop  tests", 0, function(_) {
	doStop = true;
	start();
});
