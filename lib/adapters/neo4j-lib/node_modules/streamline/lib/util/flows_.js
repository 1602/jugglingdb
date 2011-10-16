/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 * 
 * streamline.options = { "tryCatch" : "fast", "lines": "ignore" }
 */
/// !doc
/// 
/// # streamline/lib/util/flows
///  
/// Flows Module
/// 
/// The `streamline/lib/util/flows` module contains some handy utilities for streamline code
/// 
(function(exports) {
	"use strict";
	/// ## Array utilities
	/// 
	/// The following functions are async equivalents of the ES5 Array methods (`forEach`, `map`, `filter`, ...)
	/// 
	/// * `flows.each(_, array, fn, [thisObj])`  
	///   applies `fn` sequentially to the elements of `array`.  
	///   `fn` is called as `fn(_, elt, i)`.
	exports.each = function(_, array, fn, thisObj) {
		if (!array || !array.length)
			return; // array;
		var len = array.length;
		for (var i = 0; i < len; i++)
			fn.call(thisObj, _, array[i], i)
		return array;
	}
	/// * `result = flows.map(_, array, fn, [thisObj])`  
	///   transforms `array` by applying `fn` to each element in turn.  
	///   `fn` is called as `fn(_, elt, i)`.
	exports.map = function(_, array, fn, thisObj) {
		if (!array)
			return array;
		var result = [];
		var len = array.length;
		for (var i = 0; i < len; i++)
			result[i] = fn.call(thisObj, _, array[i], i);
		return result;
	}
	/// * `result = flows.filter(_, array, fn, [thisObj])`  
	///   generates a new array that only contains the elements that satisfy the `fn` predicate.  
	///   `fn` is called as `fn(_, elt)`.
	exports.filter = function(_, array, fn, thisObj) {
		if (!array)
			return array;
		var result = [];
		var len = array.length;
		for (var i = 0; i < len; i++) {
			var elt = array[i];
			if (fn.call(thisObj, _, elt))
				result.push(elt)
		}
		return result;
	}
	/// * `bool = flows.every(_, array, fn, [thisObj])`  
	///   returns true if `fn` is true on every element (if `array` is empty too).  
	///   `fn` is called as `fn(_, elt)`.
	exports.every = function(_, array, fn, thisObj) {
		if (!array)
			return; // undefined
		var len = array.length;
		for (var i = 0; i < len; i++) {
			if (!fn.call(thisObj, _, array[i]))
				return false;
		}
		return true;
	}
	/// * `bool = flows.some(_, array, fn, [thisObj])`  
	///   returns true if `fn` is true for at least one element.  
	///   `fn` is called as `fn(_, elt)`.
	exports.some = function(_, array, fn, thisObj) {
		if (!array)
			return; // undefined
		var len = array.length;
		for (var i = 0; i < len; i++) {
			if (fn.call(thisObj, _, array[i]))
				return true;
		}
		return false;
	}
	/// * `result = flows.reduce(_, array, fn, val, [thisObj])`  
	///   reduces by applying `fn` to each element.  
	///   `fn` is called as `val = fn(_, val, elt, i, array)`.
	exports.reduce = function(_, array, fn, v, thisObj) {
		if (!array)
			return v; // undefined
		var len = array.length;
		for (var i = 0; i < len; i++) {
			v = fn.call(thisObj, _, v, array[i], i, array);
		}
		return v;
	}
	/// * `result = flows.reduceRight(_, array, fn, val, [thisObj])`  
	///   reduces from end to start by applying `fn` to each element.  
	///   `fn` is called as `val = fn(_, val, elt, i, array)`.
	exports.reduceRight = function(_, array, fn, v, thisObj) {
		if (!array)
			return v; // undefined
		var len = array.length;
		for (var i = len - 1; i >= 0; i--) {
			v = fn.call(thisObj, _, v, array[i], i, array);
		}
		return v;
	}
	/// 
	/// ## Object utility
	/// 
	/// The following function can be used to iterate through object properties:
	/// 
	/// * `flows.eachKey(_, obj, fn)`  
	///   calls `fn(_, key, obj[key])` for every `key` in `obj`.
	exports.eachKey = function(_, obj, fn, thisObj) {
		if (!obj)
			return obj;
		for (var key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key))
				fn.call(thisObj, _, key, obj[key]);
		}
		return obj;
	}
	/// 
	/// ## Workflow Utilities
	/// 
	// deprecated -- don't document 
	exports.spray = function(fns, max) {
		return new
		function() {
			var funnel = exports.funnel(max);
			this.collect = function(callback, count, trim) {
				if (typeof(callback) != "function")
					throw new Error("invalid call to collect: no callback")
				var results = trim ? [] : new Array(fns.length);
				count = count < 0 ? fns.length : Math.min(count, fns.length);
				if (count == 0)
					return callback(null, results);
				var collected = 0;
				for (var i = 0; i < fns.length; i++) {
					(function(i) {
						funnel( function(err, result) {
							if (err)
								return callback(err);
							if (trim)
								results.push(result);
							else
								results[i] = result;
							if (++collected == count)
								return callback(null, results);
						}, fns[i])
					})(i);
				}
			}
			this.collectOne = function(callback) {
				return this.collect( function(err, result) {
					return callback(err, result && result[0]);
				}, 1, true)
			}
			this.collectAll = function(callback) {
				return this.collect(callback, -1, false);
			}
		}

	}
	/// * `fun = flows.funnel(max)`  
	///   limits the number of concurrent executions of a given code block.
	/// 
	/// The `funnel` function is typically used with the following pattern:
	/// 
	///     // somewhere
	///     var myFunnel = flows.funnel(10); // create a funnel that only allows 10 concurrent executions.
	///     
	///     // elsewhere
	///     myFunnel(_, function(_) { /* code with at most 10 concurrent executions */ });
	/// 
	/// The `diskUsage2.js` example demonstrates how these calls can be combined to control concurrent execution.
	/// 
	/// The `funnel` function can also be used to implement critical sections. Just set funnel's `max` parameter to 1.
	exports.funnel = function(max) {
		max = typeof max == "undefined" ? -1 : max;
		var queue = [];
		var active = 0;

		return function(callback, fn) {
			//console.log("FUNNEL: active=" + active + ", queued=" + queue.length);
			if (max < 0)
				return fn(callback);

			queue.push({
				fn: fn,
				cb: callback
			});

			function _doOne() {
				var current = queue.splice(0, 1)[0];
				if (!current.cb)
					return current.fn();
				active++;
				current.fn( function(err, result) {
					active--;
					current.cb(err, result);
					while (active < max && queue.length > 0)
						_doOne();
				});
			}

			while (active < max && queue.length > 0)
				_doOne();
		}
	}
	
	/// 
	/// * `results = flows.collect(_, futures)`  
	///   collects the results of an array of futures
	exports.collect = function(_, futures) {
		return exports.map(_, futures, function(_, future) {
			return future(_);
		});
	}
	/// 
	/// ## Context propagation
	/// 
	/// Streamline also allows you to propagate a global context along a chain of calls and callbacks.
	/// This context can be used like TLS (Thread Local Storage) in a threaded environment.
	/// It allows you to have several active chains that each have their own global context.
	/// 
	/// This kind of context is very handy to store information that all calls should be able to access
	/// but that you don't want to pass explicitly via function parameters. The most obvious example is
	/// the `locale` that each request may set differently and that your low level libraries should
	/// be able to retrieve to format messages.
	/// 
	/// The `streamline.flows` module exposes two functions to manipulate the context:
	/// 
	/// * `oldCtx = flows.setContext(ctx)`  
	///   sets the context (and returns the old context).
	exports.setContext = function(ctx) {
		var old = __global.__context;
		__global.__context = ctx;
		return old;
	}
	/// * `ctx = flows.getContext()`  
	///   returns the current context.
	exports.getContext = function() {
		return __global.__context;
	}
	
	/// 
	/// ## Miscellaneous
	/// 
	/// * `flows.nextTick(_)`  
	///   `nextTick` function for both browser and server.  
	///   Aliased to `process.nextTick` on the server side.
	exports.nextTick = typeof process === "object" && typeof process.nextTick === "function"
		? process.nextTick : function(callback) {
			setTimeout(function() { callback(); }, 0);
		};
		
	/// * `result = flows.apply(_, fn, thisObj, args, [index])`  
	///   Helper to apply `Function.apply` to streamline functions.  
	///   Equivalent to `result = fn.apply(thisObj, argsWith_)` where `argsWith_` is 
	///   a modified argument list in which the callback has been inserted at `index` 
	///   (at the end of the argument list if `index` is not specified).
	exports.apply = function apply(callback, fn, thisObj, args, index) {
		if (callback == null)
			return __future(apply, arguments, 0);
		args.splice(index != null ? index : args.length, 0, callback);
		return fn.apply(thisObj, args);
	}
})(typeof exports !== 'undefined' ? exports : (window.StreamlineFlows = window.StreamlineFlows || {}));
