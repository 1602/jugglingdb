/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */
"use strict";

var _uuidRE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function _toHex(b) {
	b = b & 0xff;
	return b < 16 ? "0" + b.toString(16) : b.toString(16);
};

function _fromHex(str, i) {
	var code = str.charCodeAt(i);
	return code < 0x3A ? code - 0x30 : code < 0x47 ? code + 10 - 0x41 : code + 10 - 0x61;
};

exports.generate = function(sep) {
	var randomHex = function(len, mask, offset) {
		var n = Math.floor(Math.random() * (1 << 24));
		if (mask)
			n = (n & mask) + offset;
		var s = n.toString(16);
		return s.length >= len ? s.substring(0, len) : ("00000000".substring(0, len - s.length) +
			s);
	};
	// Version 4 UUIDs have the form
	// xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx with hexadecimal digits x
	// and hexadecimal digits 8, 9, A, or B for y
	if (sep == null)
		sep = '-';
	return randomHex(4) + randomHex(4) + sep + randomHex(4) + sep +
	randomHex(4, 0x0fff, 0x4000) +
	sep +
	randomHex(4, 0x3fff, 0x8000) +
	sep +
	randomHex(6) +
	randomHex(6);
};
exports.fromBytes= function(bytes) {
	var s = '';
	for (var i = 0; i < bytes.length; i++) {
		if (i == 4 || i == 6 || i == 8 || i == 10)
			s += '-';
		var j = i;
		var b = bytes[j];
		s += _toHex(b);
	}
	return s;
};
exports.toBytes = function(str) {
	if (!str || str.length != 36 || !_uuidRE.test(str))
		return null;
	str = str.replace(/-/g, '');
	var bytes = [];
	for (var i = 0; i < 16; i++) {
		var j = i;
		var b = (_fromHex(str, 2 * j) << 4) + _fromHex(str, 2 * j + 1);
		bytes.push(b >= 128 ? b - 256 : b);
	}
	return bytes;
};
exports.fromString32 = function(str) {
	return [str.substring(0, 8), str.substring(8, 12), str.substring(12, 16), str.substring(16, 20), str.substring(20)].join('-').toLowerCase();
};
exports.toString32 = function(uuid) {
	return uuid.replace(/-/g, '')
};

