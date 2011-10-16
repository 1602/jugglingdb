/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 *
 * streamline.options = { "lines": "ignore" }
 */

/// !doc
/// # streamline/lib/tools/docTool
///  
/// Documentation tool
/// 
/// Usage:
/// 
///      node streamline/lib/tools/docTool [path]
/// 
/// Extracts documentation comments from `.js` files and generates `API.md` file 
/// under package root.
/// 
/// Top of source file must contain `/// !doc` marker to enable doc extraction.  
/// Documentation comments must start with `/// ` (with 1 trailing space).  
/// Extraction can be turned off with `/// !nodoc` and turned back on with `/// !doc`.
/// 
/// The tool can also be invoked programatically with:
/// 
var fs = require('fs');
var fsp = require('path');

/// * `doc = docTool.generate(_, path)`
///   extracts documentation comments from file `path`
exports.generate = function(_, path, options) {
	options = options || {}
	function _generate(_, path) {
		var stat = fs.stat(path, _);
		if (stat.isFile()) {
			if (path.indexOf('.js') == path.length - 3) {
				var inside;
				var doc = fs.readFile(path, "utf8", _).split('\n').map( function(line) {
					var i = line.indexOf('//' + '/ ');
					line = i >= 0 ? line.substring(i + 4) : null;
					if (line === "!doc") {
						inside = true;
					} else if (line === "!nodoc") {
						inside = false;
					} else
						return inside && line != null ? line + "\n" : null;
				}).filter( function(line) {
					return line != null;
				}).join("");
				return doc || "";
			}
			return "";
		} else if (stat.isDirectory()) {
			var pair = path.split("/node_modules/");
			var isPackage = pair[1] && pair[1].indexOf('/') < 0;
			var doc = "";
			var files = fs.readdir(path, _);
			for (var i = 0; i < files.length; i++) {
				doc += _generate(_, path + "/" + files[i]);
			}
			if (isPackage && doc) {
				fs.writeFile(path + "/API.md", doc, "utf8", _);
				if (options.verbose)
					console.log("generated " + path + "/API.md");
				doc = "";
			}
			return doc;
		} else
			return "";
	}
	_generate(_, path);

}
if (process.argv[1] && process.argv[1].indexOf("/docTool") >= 0)
	exports.generate(_, fsp.join(process.cwd(), process.argv[2] || '.'), { verbose: true });
