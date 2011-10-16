"use strict";
//streamline.options = { "tryCatch" : "fast", "lines" : "ignore" }
// Analyzes require dependencies
var fs = require('fs');
var fspath = require('path');
var uuid = require('streamline/lib/util//uuid');
var flows = require('streamline/lib/util/flows');
var modulesDir;
var each = flows.each;

var dependencies = {};

var commentsRE = /(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*)/g;
var requireRE = /require\s*\(('|")([\w\W]*?)('|")\)/mg;

var funnel = flows.funnel(1);

function _exists(callback, path) {
	fspath.exists(path, function(result) {
		return callback(null, result);
	});
}

function _findModulesDir(_) {
	if (modulesDir)
		return modulesDir;
	for (var dir = __dirname; dir.length > 0; dir = dir.substring(0, dir.lastIndexOf('/'))) {
		if (_exists(_, dir + "/node_modules")) {
			modulesDir = dir + "/node_modules";
			return modulesDir;
		}
	}
	throw new Error("cannot resolve module: node_modules not found")
}

function _combine(path, rel) {
	var cut = path.lastIndexOf('/');
	if (cut <= 0)
		throw new Error("too many parent dirs" + rel);
	path = path.substring(0, cut);
	while (rel.indexOf('./.') == 0) // get rid of leading ./. and ./..
		rel = rel.substring(2);
	if (rel.indexOf('../') == 0)
		return _combine(path, rel.substring(1));
	if (rel.indexOf('./') != 0)
		return modulesDir + "/" + rel;
	return path + rel.substring(1);
}

var _etag = uuid.generate();
var _watched = {};

function _watcher(stats) {
	//console.log("WATCHER!")
	funnel(null, function() {
		// one of the files changed: regenerate etag and reset cache
		_etag = uuid.generate();
		// unwatch all files because list may change
		Object.keys(_watched).forEach( function(path) {
			fs.unwatchFile(path);
		});
		_watched = {};
		dependencies = {};
	});
	//console.log("WATCHER DONE!")
}

exports.etag = function() {
	return "" + _etag;
}
function _watch(file) {
	if (!_watched[file]) {
		_watched[file] = true;
		fs.watchFile(file, _watcher);
	}
}

function _loadFile(_, path) {
	var js = path + ".js";
	var js_ = path + "_.js";
	if (_exists(_, js_)) {
		_watch(js_);
		return require("streamline/lib/compiler/compile").loadFile(_, path);
	} else if (_exists(_, js)) {
		_watch(js);
		return fs.readFile(js, "utf8", _);
	} else
		throw new Error("invalid require path: " + path);
}

function _extendPath(_, path) {
	if (!_exists(_, path + ".js") && _exists(_, path) && fs.stat(path, _).isDirectory()) {
		// should read package.json here -- see later
		if (_exists(_, path + "/main.js"))
			return path + "/main";
		else if (_exists(_, path + "/index.js"))
			return path + "/index";
	}
	return path;
}

// Returns all the dependencies of a given js file
// Can be used to build a dependency graph
function _directDependencies(_, path) {
	if (dependencies[path])
		return dependencies[path];
	_findModulesDir(_);
	var result = [];
	dependencies[path] = result;
	var str = _loadFile(_, path);
	str = str.replace(commentsRE, "");
	var match;
	while (match = requireRE.exec(str))
		result.push(_combine(path, match[2]));
	return result;
}

// Returns all the dependencies that we reach from path (recursively) but
// the we don't reach from any of the known paths (recursively too).
// Used to return require lists to the client
function _missingDependencies(_, path, known) {
	var knownMap = {};
	known.forEach( function(key) {
		knownMap[key] = true;
	});
	function _explore(_, path, missingMap) {
		path = _extendPath(_, path);
		if (knownMap[path])
			return;
		if (missingMap)
			missingMap[path] = true;
		knownMap[path] = true;
		var dependencies = _directDependencies(_, path);
		each(_, dependencies, function(_, dependency) {
			_explore(_, dependency, missingMap);
		});
	}

	var missingMap = {};
	// first explore known path, to fill knownMap with all their dependencies
	each(_, known, function(_, cur) {
		_explore(_, cur, null);
	});
	// then fill missing map
	_explore(_, path, missingMap);
	return Object.keys(missingMap);
}

exports.directDependencies = function(_, path) {
	return funnel(_, function(_) {
		return _directDependencies(_, path);
	})
}
exports.missingDependencies = function(_, path, known) {
	return funnel(_, function(_) {
		return _missingDependencies(_, path, known);
	})
}
