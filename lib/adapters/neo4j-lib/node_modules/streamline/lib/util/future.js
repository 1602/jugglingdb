/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */
(function(exports) {
	exports.future = function(fn, args, i) {
		var done, err, result;
		var cb = function(e, r) {
			done = true; err = e, result = r;
		};
		args = Array.prototype.slice.call(args);
		args[i == null ? fn.length - 1 : i] = function(e, r) {
			cb(e, r);
		};
		fn.apply(this, args);
		return function(_) {
			if (done)
				_.call(this, err, result);
			else
				cb = _.bind(this);
		}.bind(this);
	}
})(typeof exports !== 'undefined' ? exports : (window.StreamlineFuture = window.StreamlineFuture || {}));

