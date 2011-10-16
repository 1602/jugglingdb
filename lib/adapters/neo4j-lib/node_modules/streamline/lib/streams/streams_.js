/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */
"use strict";
//streamline.options = { "tryCatch" : "fast", "lines" : "ignore" }

/// !nodoc -- experimental combo streams
/// 
function copy(src, dst) {
	Object.keys(src).forEach(function(key) { dst[key] = src[key]})
}
if (typeof process === "object" && typeof process.cwd === "function") {
	copy(require('./server/' + 'streams'), exports);
}
else {
	copy(require('./client/streams'), exports);
}
