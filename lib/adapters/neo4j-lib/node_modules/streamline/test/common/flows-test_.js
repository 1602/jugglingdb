//streamline.options = { "tryCatch" : "fast", "lines" : "preserve" }
var module = QUnit.module;
var flows = require("streamline/lib/util/flows");

function delay(_, val) {
	flows.nextTick(_);
	return val;
}

function delayFail(_, err) {
	flows.nextTick(_);
	throw err;
}

module("flows");

asyncTest("each", 1, function(_) {
	var result = 1;
	flows.each(_, [1, 2, 3, 4], function(_, val) {
		result = result * delay(_, val);
	})
	strictEqual(result, 24);
	start();
})
asyncTest("map", 1, function(_) {
	var result = flows.map(_, [1, 2, 3, 4], function(_, val) {
		return 2 * delay(_, val);
	});
	deepEqual(result, [2, 4, 6, 8]);
	start();
})
asyncTest("filter", 1, function(_) {
	var result = flows.filter(_, [1, 2, 3, 4], function(_, val) {
		return delay(_, val) % 2;
	});
	deepEqual(result, [1, 3]);
	start();
})
asyncTest("every", 1, function(_) {
	var result = flows.every(_, [1, 2, 3, 4], function(_, val) {
		return delay(_, val) < 5;
	});
	strictEqual(result, true);
	start();
});
asyncTest("every", 1, function(_) {
	var result = flows.every(_, [1, 2, 3, 4], function(_, val) {
		return delay(_, val) < 3;
	});
	strictEqual(result, false);
	start();
});
asyncTest("some", 1, function(_) {
	var result = flows.some(_, [1, 2, 3, 4], function(_, val) {
		return delay(_, val) < 3;
	});
	strictEqual(result, true);
	start();
});
asyncTest("some", 1, function(_) {
	var result = flows.some(_, [1, 2, 3, 4], function(_, val) {
		return delay(_, val) < 0;
	});
	strictEqual(result, false);
	start();
});
asyncTest("reduce", 1, function(_) {
	var result = flows.reduce(_, [1, 2, 3, 4], function(_, v, val) {
		return v * delay(_, val);
	}, 1);
	strictEqual(result, 24);
	start();
});
asyncTest("reduceRight", 1, function(_) {
	var result = flows.reduceRight(_, [1, 2, 3, 4], function(_, v, val) {
		return v * delay(_, val);
	}, 1);
	strictEqual(result, 24);
	start();
});
asyncTest("collectAll", 1, function(_) {
	var total = 0;
	var peak = 0;
	var count = 0;
	function doIt(i) {
		return function(_) {
			count++;
			peak = Math.max(count, peak);
			total += delay(_, i);
			count--;
			return 2 * i;
		}
	}

	var results = flows.spray([doIt(1), doIt(2), doIt(3)]).collectAll(_);
	deepEqual([total, peak, count, results], [6, 3, 0, [2, 4, 6]]);
	start();
})
asyncTest("collectOne", 1, function(_) {
	var total = 0;
	var peak = 0;
	var count = 0;
	function doIt(i) {
		return function(_) {
			count++;
			peak = Math.max(count, peak);
			total += delay(_, i);
			count--;
			return 2 * i;
		}
	}

	var result = flows.spray([doIt(1), doIt(2), doIt(3)]).collectOne(_);
	deepEqual([total, peak, count, result], [1, 3, 2, 2]);
	start();
})
asyncTest("collectAll with limit", 1, function(_) {
	var total = 0;
	var peak = 0;
	var count = 0;
	function doIt(i) {
		return function(_) {
			count++;
			peak = Math.max(count, peak);
			total += delay(_, i);
			count--;
			return 2 * i;
		}
	}

	var results = flows.spray([doIt(1), doIt(2), doIt(3)], 2).collectAll(_);
	deepEqual([total, peak, count, results], [6, 2, 0, [2, 4, 6]]);
	start();
})
asyncTest("contexts", 3, function(_) {
	function testContext(_, x) {
		flows.setContext({
			val: x
		});
		var y = delay(_, 2 * x);
		strictEqual(y, 2 * flows.getContext().val);
		return y + 1;
	}

	var result = flows.spray([
	function(_) {
		return testContext(_, 3);
	},

	function(_) {
		return testContext(_, 5);
	}

	]).collectAll(_);
	deepEqual(result, [7, 11]);
	start();
})

