/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */
"use strict";
exports.parseQueryString = function(str) {
	return (str || '').split('&').reduce(function(result, param) {
		var pair = param.split('=');
		result[pair[0]] = decodeURIComponent(pair[1]);
		return result;
	}, {});
}