var module = QUnit.module;
var transform = require('streamline/lib/compiler/transform').transform;

module("streamline generation");

function clean(s){
	if (typeof jQuery === "function" && jQuery.browser.mozilla) 
		return new Function(s).toString();
	else 
		return s.replace(/[\n\t ]/g, '').replace(/};/g, '}').replace(/=\(_\|\|__trap\)/g, '=_||__trap');
}

function genTest(f1, f2, pedantic){
	var s1 = clean(transform(f1.toString(), {
		noHelpers: true,
		lines: "ignore",
		tryCatch: pedantic ? "pedantic" : "safe"
	}));
	var s2 = clean(f2.toString());
	if (s1 !== s2) {
		console.log("transformed=" + s1);
		console.log("expected   =" + s2);
	}
	strictEqual(s1, s2);
}

test("basic", 1, function(){
	genTest(function f(_){
		f1(_);
		f2();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		return f1(__cb(_, function(){
			f2();
			_();
		}));
	});
});
test("basic with try/catch", 1, function(){
	genTest(function f(_){
		f1(_);
		f2();
	}, function f(_){
		if (!_) {
			return __future.call(this, f, arguments, 0);
		}
		_ = __wrapIn(_);
		try {
			return f1(__cb(_, function(){
				f2();
				_();
			}));
		} 
		catch (e) {
			return __propagate(_, e);
		}
	}, true);
});
test("var return", 1, function(){
	genTest(function f(_){
		var x = f1(_);
		f2();
		return x;
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		var x;
		return f1(__cb(_, function(__0, __1){
			x = __1;
			f2();
			return _(null, x);
		}));
	});
});
test("return", 1, function(){
	genTest(function f(_){
		f1();
		return f2(_);
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return f2(_);
	});
});
test("if", 1, function(){
	genTest(function f(_, b){
		f1();
		if (b) {
			f2();
			f3(_);
			f4();
		}
		f5();
	}, function f(_, b){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(__then){
			if (b) {
				f2();
				return f3(__cb(_, function(){
					f4();
					__then();
				}));
			}
			else {
				__then();
			}
		})(function(){
			f5();
			_();
		});
	});
});
test("simplified if", 1, function(){
	genTest(function f(_, b){
		f1();
		if (b) {
			f2();
			f3(_);
			f4();
		}
	}, function f(_, b){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(__then){
			if (b) {
				f2();
				return f3(__cb(_, function(){
					f4();
					__then();
				}));
			}
			else {
				__then();
			}
		})(_);
	});
});
test("if else", 1, function(){
	genTest(function f(_, b){
		f1();
		if (b) {
			f2();
			f3(_);
			f4();
		}
		else {
			f5();
			f6(_);
			f7();
		}
		f8();
	}, function f(_, b){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(__then){
			if (b) {
				f2();
				return f3(__cb(_, function(){
					f4();
					__then();
				}));
			}
			else {
				f5();
				return f6(__cb(_, function(){
					f7();
					__then();
				}));
			}
		})(function(){
			f8();
			_();
		});
	});
});
test("if else 2", 1, function(){
	genTest(function f(_, b){
		f1();
		if (b) {
			f2();
			f3(_);
			f4();
			return 1;
		}
		else {
			f5();
		}
		f6();
		return 2;
	}, function f(_, b){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(__then){
			if (b) {
				f2();
				return f3(__cb(_, function(){
					f4();
					return _(null, 1);
				}));
			}
			else {
				f5();
				__then();
			}
		})(function(){
			f6();
			return _(null, 2);
		});
	});
});
test("each", 1, function(){
	genTest(function f(_, arr){
		f1();
		each(_, arr, function(_, elt){
			f2(_, elt);
			f3();
		})
		f4();
	}, function f(_, arr){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return each(__cb(_, function(){
			f4();
			_();
		}), arr, function __1(_, elt){
			if (!_) {
				return __future(__1, arguments, 0);
			}
			return f2(__cb(_, function(){
				f3();
				_();
			}), elt);
		});
	});
});
test("while", 1, function(){
	genTest(function f(_){
		f1();
		while (cond) {
			f2(_);
			f3();
		}
		f4();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(__break){
			var __loop = __nt(_, function(){
				var __1 = cond;
				if (__1) {
					return f2(__cb(_, function(){
						f3();
						__loop();
					}));
				}
				else {
					__break();
				}
			});
			__loop();
		})(function(){
			f4();
			_();
		});
	});
});
test("do while", 1, function(){
	genTest(function f(_){
		f1();
		do {
			f2(_);
			f3();
		}
		while (cond);
		f4();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		var __1 = true;
		return (function(__break){
			var __loop = __nt(_, function(){
				var __2 = (__1 || cond);
				if (__2) {
					__1 = false;
					return f2(__cb(_, function(){
						f3();
						__loop();
					}));
				}
				else {
					__break();
				}
			});
			__loop();
		})(function(){
			f4();
			_();
		});
	});
});
test("for", 1, function(){
	genTest(function f(_, arr){
		f1();
		for (var i = 0; i < arr.length; i++) {
			f2(_);
			f3();
		}
		f4();
	}, function f(_, arr){
		if (!_) {
			return __future(f, arguments, 0);
		}
		var i;
		f1();
		i = 0;
		var __2 = false;
		return (function(__break){
			var __loop = __nt(_, function(){
				if (__2) {
					i++;
				}
				else {
					__2 = true;
				}
				var __1 = (i < arr.length);
				if (__1) {
					return f2(__cb(_, function(){
						f3();
						__loop();
					}));
				}
				else {
					__break();
				}
			});
			__loop();
		})(function(){
			f4();
			_();
		});
	})
})
test("for in", 1, function(){
	genTest(function f(_){
		f1();
		for (var k in obj) {
			f2(_, k);
			f3(k);
		}
		f4();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		var k;
		f1();
		var __1 = __forIn(obj);
		var __2 = 0;
		return (function(__break){
			var __loop = __nt(_, function(){
				var __3 = (__2 < __1.length);
				if (__3) {
					k = __1[__2++];
					return f2(__cb(_, function(){
						f3(k);
						__loop();
					}), k);
				}
				else {
					__break();
				}
			});
			__loop();
		})(function(){
			f4();
			_();
		});
	});
})
test("for in (without var)", 1, function(){
	genTest(function f(_){
		var k;
		f1();
		for (k in obj) {
			f2(_, k);
			f3(k);
		}
		f4();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		var k;
		f1();
		var __1 = __forIn(obj);
		var __2 = 0;
		return (function(__break){
			var __loop = __nt(_, function(){
				var __3 = (__2 < __1.length);
				if (__3) {
					k = __1[__2++];
					return f2(__cb(_, function(){
						f3(k);
						__loop();
					}), k);
				}
				else {
					__break();
				}
			});
			__loop();
		})(function(){
			f4();
			_();
		});
	});
})
test("switch", 1, function(){
	genTest(function f(_){
		f1();
		switch (exp) {
			case 'a':
				f2(_);
				f3();
				break;
			case 'b':
			case 'c':
				f4();
				f5(_);
				break;
			default:
				f6();
				break;
		}
		f7();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(__break){
			switch (exp) {
				case "a":
					return f2(__cb(_, function(){
						f3();
						return __break();
					}));
				case "b":
				case "c":
					f4();
					return f5(__cb(_, __break));
				default:
					f6();
					return __break();
			}
		})(function(){
			f7();
			_();
		});
	});
})
test("nested switch", 1, function(){
	genTest(function f(_){
		switch (exp) {
			case 'a':
				f2(_);
				switch (exp2) {
					case "b":
						break;
				}
				break;
		}
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		return (function(__break){
			switch (exp) {
				case "a":
					return f2(__cb(_, function(){
						switch (exp2) {
							case "b":
								break;
						}
						return __break();
					}));
				default:
					return __break();
			}
		})(_);
	});
})
test("nested calls", 1, function(){
	genTest(function f(_){
		f1();
		f2(_, f3(_, f4(_)), f5(_, f6()));
		f7();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return f4(__cb(_, function(__0, __1){
			return f3(__cb(_, function(__0, __2){
				return f5(__cb(_, function(__0, __3){
					return f2(__cb(_, function(){
						f7();
						_();
					}), __2, __3);
				}), f6());
			}), __1);
		}));
	});
})
test("async while condition", 1, function(){
	genTest(function f(_){
		f1();
		while (f2(_)) 
			f3();
		f4();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(__break){
			var __loop = __nt(_, function(){
				return f2(__cb(_, function(__0, __1){
					if (__1) {
						f3();
						__loop();
					}
					else {
						__break();
					}
				}));
			});
			__loop();
		})(function(){
			f4();
			_();
		});
	})
})
test("try catch", 1, function(){
	genTest(function f(_){
		f1();
		try {
			f2();
			f3(_);
			f4();
		} 
		catch (ex) {
			f5();
			f6(_);
			f7();
		}
		f8();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(__then){
			(function(_){
				__tryCatch(_, function(){
					f2();
					return f3(__cb(_, function(){
						f4();
						__then();
					}));
				});
				
			})(function(ex, __result){
				__tryCatch(_, function(){
					if (ex) {
						f5();
						return f6(__cb(_, function(){
							f7();
							__then();
						}));
					}
					else {
						_(null, __result);
					}
				});
			});
		})(function(){
			__tryCatch(_, function(){
				f8();
				_();
			});
		});
	});
})
test("try finally", 1, function(){
	genTest(function f(_){
		f1();
		try {
			f2();
			f3(_);
			f4();
		}
		finally {
			f5();
			f6(_);
			f7();
		}
		f8();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(__then){
			(function(_){
				__tryCatch(_, function(){
					f2();
					return f3(__cb(_, function(){
						f4();
						_(null, null, true);
					}));
				});
			})(function(__e, __r, __cont){
				(function(__then){
					__tryCatch(_, function(){
						f5();
						return f6(__cb(_, function(){
							f7();
							__then();
						}));
					});
				})(function(){
					__tryCatch(_, function(){
						if (__cont) {
							__then();
						}
						else {
							_(__e, __r);
						}
					});
				});
			});
		})(function(){
			__tryCatch(_, function(){
				f8();
				_();
			});
		});
	})
})
test("lazy and", 1, function(){
	// Note: __future is overkill in inner as _ cannot be null - fix later
	genTest(function f(_){
		f1();
		if (f2(_) && f3(_)) {
			f4();
			f5(_);
			f6()
		}
		f7();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		f1();
		return (function(_){
			return f2(__cb(_, function(__0, __1){
				var __2 = !__1;
				return (function(__then){
					if (__2) {
						var __3 = __1;
						return _(null, __3);
					}
					else {
						__then();
					}
				})(function(){
					return f3(_);
				});
			}));
		})(__cb(_, function(__0, __2){
			return (function(__then){
				if (__2) {
					f4();
					return f5(__cb(_, function(){
						f6();
						__then();
					}));
				}
				else {
					__then();
				}
			})(function(){
				f7();
				_();
			});
		}));
	})
})
test("empty body", 1, function(){
	genTest(function f(_){
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		_();
	})
})
test("only return in body", 1, function(){
	genTest(function f(_){
		return 4;
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		return _(null, 4);
	})
})
test("optim pass _", 1, function(){
	genTest(function f(_, arg1){
		return g(_, arg2);
	}, function f(_, arg1){
		if (!_) {
			return __future(f, arguments, 0);
		}
		return g(_, arg2);
	})
})
test("out wrappers", 1, function(){
	genTest(function f(_, arg1){
		return g(__wrapOut(_), arg2) + 5;
	}, function f(_, arg1){
		if (!_) {
			return __future(f, arguments, 0);
		}
		return g(__wrapOut(__cb(_, function(__0, __2){
			var __1 = (__2 + 5);
			return _(null, __1);
		})), arg2);
	})
})
test("scoping", 1, function(){
	genTest(function f(_){
		g(_);
		if (x) {
			var a1, a2, a3, b1 = 1, b2 = 2, b3 = 3;
			var c1, c2;
			a1 = 1;
			a2 = 2;
		}
		else {
			var a2 = 2;
			b2++;
			c1 = 1;
		}
		a3++;
		b3++;
		c2 = 2;
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		var a1, a2, a3, b1, b2, b3, c1, c2;
		return g(__cb(_, function(){
			if (x) {
				b1 = 1;
				b2 = 2;
				b3 = 3;
				a1 = 1;
				a2 = 2;
			}
			else {
				a2 = 2;
				b2++;
				c1 = 1;
			}
			a3++;
			b3++;
			c2 = 2;
			_();
		}));
	})
})
test("sync code not modified", 1, function(){
	genTest(function f(){
		g();
		if (x) {
			var a1, a2, a3, b1 = 1, b2 = 2, b3 = 3;
			var c1, c2;
			a1 = 1;
			a2 = 2;
		}
		else {
			var a2 = 2;
			b2++;
			c1 = 1;
		}
		a3++;
		b3++;
		c2 = 2;
	}, function f(){
		g();
		if (x) {
			var a1, a2, a3, b1 = 1, b2 = 2, b3 = 3;
			var c1, c2;
			a1 = 1;
			a2 = 2;
		}
		else {
			var a2 = 2;
			b2++;
			c1 = 1;
		}
		a3++;
		b3++;
		c2 = 2;
	})
})
test("function forward reference", 1, function(){
	genTest(function f(_){
		foo();
		g(_);
		function foo(){
		};
		
			}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		}
		function foo(){
		}
		
		foo();
		return g(_);
	})
})
test("CoffeeScript closure ()", 1, function(){
	genTest(function f(_){
		(function(){
			return g(_);
		})();
	}, function f(_){
		if (!_) {
			return __future(f, arguments, 0);
		};
		return (function __1(_){
			return g(_);
		})(_);
	})
})
test("CoffeeScript closure (this)", 1, function(){
	genTest(function f(_){
		(function(){
			return g(_, this);
		}).call(this);
	}, function f(_){
		if (!_) {
			return __future.call(this, f, arguments, 0);
		};
		var __this = this;
		return (function __1(_){
			return g(_, __this);
		})(_);
	})
})
test("CoffeeScript closure (this, arguments)", 1, function(){
	genTest(function f(_){
		(function(){
			return g(_, this, arguments);
		}).apply(this, arguments);
	}, function f(_){
		if (!_) {
			return __future.call(this, f, arguments, 0);
		};
		var __this = this, __arguments = arguments;
		return (function __1(_){
			return g(_, __this, __arguments);
		})(_);
	})
})
module("streamline evaluation");
function evalTest1(f, val, options, next){
	var str = transform(f.toString(), options);
	(function(){
		eval(str);
		f(function(err, result){
			var str = err ? "ERR: " + err : result;
			strictEqual(str, val);
			next();
		})
	})();
}

function evalTest(f, val){
	delay = delayUnsafe;
	evalTest1(f, val, {
		tryCatch: "safe"
	}, function(){
		delay = delaySafe;
		evalTest1(f, val, {
			tryCatch: "fast"
		}, start)
	})
}

function delayUnsafe(_, val){
	setTimeout(function(){
		_(null, val);
	}, 0);
}

function delaySafe(_, val){
	setTimeout(function(){
		try {
			_(null, val);
		} 
		catch (ex) {
			_(ex)
		}
	}, 0);
}

var delay;

function delayFail(_, err){
	setTimeout(function(){
		_(err);
	}, 0);
}

function throwError(message){
	throw new Error(message);
}

asyncTest("eval return", 2, function(){
	evalTest(function f(_){
		return delay(_, 5);
	}, 5);
})
asyncTest("eval if true", 2, function(){
	evalTest(function f(_){
		if (true) 
			return delay(_, 3);
		return 4;
	}, 3);
})
asyncTest("eval if false", 2, function(){
	evalTest(function f(_){
		if (false) 
			return delay(_, 3);
		return 4;
	}, 4);
})
asyncTest("eval while", 2, function(){
	evalTest(function f(_){
		var i = 1, result = 1;
		while (i < 5) {
			result = delay(_, i * result);
			i++;
		}
		return result;
	}, 24);
})
asyncTest("eval for", 2, function(){
	evalTest(function f(_){
		var result = 1;
		for (var i = 1; i < 5; i++) {
			result = delay(_, i) * delay(_, result);
		}
		return result;
	}, 24);
})
asyncTest("eval for in", 2, function(){
	evalTest(function f(_){
		var foo = {
			a: 1,
			b: 2,
			c: 3,
			d: 5
		}
		var result = 1;
		for (var k in foo) {
			result = delay(_, foo[delay(_, k)]) * delay(_, result);
		}
		return result;
	}, 30);
})
asyncTest("fully async for in", 2, function(){
	evalTest(function f(_){
		var result = 1;
		for (var i = delay(_, 2); i < delay(_, 5); i = delay(_, i) + 1) {
			result = delay(_, result) * delay(_, i)
		}
		return result;
	}, 24);
})
asyncTest("break in loop", 2, function(){
	evalTest(function f(_){
		var result = 1;
		for (var i = 1; i < 10; i++) {
			if (i == 5) 
				break;
			result = delay(_, result) * delay(_, i)
		}
		return result;
	}, 24);
})
asyncTest("continue", 2, function(){
	evalTest(function f(_){
		var result = 1;
		for (var i = 1; i < 10; i++) {
			if (i >= 5) 
				continue;
			result = delay(_, result) * delay(_, i)
		}
		return result;
	}, 24);
})
asyncTest("break in while", 2, function(){
	evalTest(function f(_){
		var i = 1, result = 1;
		while (i < 10) {
			if (i == 5) 
				break;
			result = delay(_, result) * delay(_, i);
			i++;
		}
		return result;
	}, 24);
})
asyncTest("continue in while", 2, function(){
	evalTest(function f(_){
		var i = 1, result = 1;
		while (i < 10) {
			i++;
			if (i >= 5) 
				continue;
			result = delay(_, result) * delay(_, i);
		}
		return result;
	}, 24);
})
asyncTest("eval lazy", 2, function(){
	evalTest(function f(_){
		var result = 1;
		return delay(_, delay(_, result + 8) < 5) && true ? 2 : 4
	}, 4);
})
asyncTest("eval lazy full async", 2, function(){
	evalTest(function f(_){
		var result = 1;
		return delay(_, delay(_, result + 8) < 5) && true ? delay(_, 2) : delay(_, 4)
	}, 4);
})
asyncTest("try catch 1", 2, function(){
	evalTest(function f(_){
		try {
			return delay(_, "ok");
		} 
		catch (ex) {
			return delay(_, "err");
		}
	}, "ok");
})
asyncTest("try catch 2", 2, function(){
	evalTest(function f(_){
		try {
			throw delay(_, "thrown");
		} 
		catch (ex) {
			return delay(_, "caught ") + ex;
		}
	}, "caught thrown");
})
asyncTest("try catch 3", 2, function(){
	evalTest(function f(_){
		try {
			throw delay(_, "thrown");
		} 
		catch (ex) {
			return delay(_, "caught ") + ex;
		}
	}, "caught thrown");
})
asyncTest("try catch 5", 2, function(){
	evalTest(function f(_){
		try {
			delayFail(_, "delay fail");
		} 
		catch (ex) {
			return delay(_, "caught ") + ex;
		}
	}, "caught delay fail");
})
asyncTest("try catch 6", 2, function(){
	evalTest(function f(_){
		try {
			throwError("direct")
			return delay(_, "ok")
		} 
		catch (ex) {
			return delay(_, "caught ") + ex.message;
		}
	}, "caught direct");
})
asyncTest("try catch 7", 2, function(){
	evalTest(function f(_){
		try {
			var message = delay(_, "indirect");
			throwError(message)
			return delay(_, "ok")
		} 
		catch (ex) {
			return delay(_, "caught ") + ex.message;
		}
	}, "caught indirect");
})
asyncTest("try finally 1", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			x += delay(_, "try")
		}
		finally {
			x += delay(_, " finally");
		}
		x += " end"
		return x;
	}, "try finally end");
})
asyncTest("try finally 2", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			x += delay(_, "try")
			return x;
		}
		finally {
			x += delay(_, " finally");
		}
		x += " end"
		return x;
	}, "try");
})
asyncTest("try finally 3", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			x += delay(_, "try")
			throw "bad try";
		}
		finally {
			x += delay(_, " finally");
		}
		x += " end"
		return x;
	}, "ERR: bad try");
})
asyncTest("try finally 4", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			x += delay(_, "try")
			throwError("except");
		}
		finally {
			x += delay(_, " finally");
		}
		x += " end"
		return x;
	}, "ERR: Error: except");
})
asyncTest("try finally 5", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			try {
				x += delay(_, "try")
				throwError("except");
				x += " unreached"
			}
			finally {
				x += delay(_, " finally");
			}
			x += " end"
			return x;
		} 
		catch (ex) {
			return x + "/" + ex.message;
		}
	}, "try finally/except");
})
asyncTest("try catch finally 1", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			try {
				x += delay(_, "try")
				throw new Error("except");
				x += " unreached"
			} 
			catch (ex) {
				x += delay(_, " catch " + ex.message);
				throw ex;
			}
			finally {
				x += delay(_, " finally");
			}
			x += " end"
			return x;
		} 
		catch (ex) {
			return x + "/" + ex.message;
		}
	}, "try catch except finally/except");
})
asyncTest("try catch finally 2", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			try {
				x += delay(_, "try")
				throwError("except");
				x += " unreached"
			} 
			catch (ex) {
				x += " catch " + ex.message;
				throw ex;
			}
			finally {
				x += " finally";
			}
			x += " end"
			return x;
		} 
		catch (ex) {
			return x + "/" + ex.message;
		}
	}, "try catch except finally/except");
})
asyncTest("nested try/catch 1", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			try {
				x += delay(_, "try")
			} 
			catch (ex) {
				x += delay(_, " inner catch " + ex.message);
			}
			throwError(" except");
		} 
		catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try outer catch except");
})
asyncTest("nested try/catch 2", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			try {
				x += delay(_, "try")
			} 
			catch (ex) {
				x += " inner catch " + ex.message;
			}
			throw new Error(" except");
		} 
		catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try outer catch except");
})
asyncTest("nested try/catch 3", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			try {
				x += delay(_, "try")
			} 
			catch (ex) {
				x += delay(_, " inner catch " + ex.message);
			}
			throw new Error(" except");
		} 
		catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try outer catch except");
})
asyncTest("nested try/finally 1", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			try {
				x += delay(_, "try")
			}
			finally {
				x += delay(_, " inner finally");
			}
			throwError(" except");
		} 
		catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try inner finally outer catch except");
})
asyncTest("nested try/finally 2", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			try {
				x += delay(_, "try")
			}
			finally {
				x += " inner finally";
			}
			throwError(" except");
		} 
		catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try inner finally outer catch except");
})
asyncTest("nested try/finally 3", 2, function(){
	evalTest(function f(_){
		var x = "";
		try {
			try {
				x += delay(_, "try")
			}
			finally {
				x += delay(_, " inner finally");
			}
			throw new Error(" except");
		} 
		catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try inner finally outer catch except");
})
asyncTest("and ok", 2, function(){
	evalTest(function f(_){
		var x = "<<";
		if (delay(_, true) && delay(_, true)) 
			x += "T1";
		else 
			x += "F1"
		if (delay(_, true) && delay(_, false)) 
			x += "T2";
		else 
			x += "F2"
		if (delay(_, false) && delay(_, true)) 
			x += "T3";
		else 
			x += "F3"
		if (delay(_, false) && delay(_, false)) 
			x += "T4";
		else 
			x += "F4"
		if (delay(_, false) && delayFail(_, "bad")) 
			x += "T5";
		else 
			x += "F5"
		x += ">>";
		return x;
	}, "<<T1F2F3F4F5>>");
})
asyncTest("or ok", 2, function(){
	evalTest(function f(_){
		var x = "<<";
		if (delay(_, true) || delay(_, true)) 
			x += "T1";
		else 
			x += "F1"
		if (delay(_, true) || delay(_, false)) 
			x += "T2";
		else 
			x += "F2"
		if (delay(_, false) || delay(_, true)) 
			x += "T3";
		else 
			x += "F3"
		if (delay(_, false) || delay(_, false)) 
			x += "T4";
		else 
			x += "F4"
		if (delay(_, true) || delayFail(_, "bad")) 
			x += "T5";
		else 
			x += "F5"
		x += ">>";
		return x;
	}, "<<T1T2T3F4T5>>");
})
asyncTest("switch with default", 2, function(){
	evalTest(function f(_){
		function g(_, i){
			var result = "a"
			switch (delay(_, i)) {
				case 1:
					result = delay(_, "b");
					break;
				case 2:
					return delay(_, "c");
				case 3:
				case 4:
					result = delay(_, "d");
					break;
				default:
					result = delay(_, "e");
			}
			return result;
		}
		
		return g(_, 0) + g(_, 1) + g(_, 2) + g(_, 3) + g(_, 4) + g(_, 5);
	}, "ebcdde");
})
asyncTest("switch without default", 2, function(){
	evalTest(function f(_){
		function g(_, i){
			var result = "a"
			switch (delay(_, i)) {
				case 1:
					result = "b";
					break;
				case 2:
					return "c";
				case 3:
				case 4:
					result = "d";
					break;
			}
			return result;
		}
		
		return g(_, 0) + g(_, 1) + g(_, 2) + g(_, 3) + g(_, 4) + g(_, 5);
	}, "abcdda");
})
asyncTest("this", 10, function(){
	evalTest(function f(_){
		function O(x){
			this.x = x;
		}
		
		O.prototype.test1 = function(_){
			var self = this;
			this.x = delay(_, this.x + 1);
			strictEqual(this, self);
		}
		O.prototype.test2 = function(_){
			var self = this;
			try {
				this.x = delay(_, this.x + 1);
				strictEqual(this, self);
			} 
			catch (ex) {
				ok(false);
			}
		}
		O.prototype.test3 = function(_){
			var self = this;
			try {
				this.x = delay(_, this.x + 1);
				throwError("test3");
				ok(false);
			} 
			catch (ex) {
				strictEqual(this, self);
				this.x = delay(_, this.x + 1);
			}
		}
		function delay2(val, _){
			return delay(_, val);
		}
		
		O.prototype.test4 = function(_){
			var self = this;
			v1 = delay2(this.x + 1);
			v2 = delay2(1);
			this.x = v1(_) + v2(_);
			strictEqual(this, self);
		}
		var o = new O(1);
		o.test1(_);
		o.test2(_);
		o.test3(_);
		o.test4(_);
		return o.x;
	}, 7);
})
asyncTest("scoping", 2, function(){
	evalTest(function f(_){
		function test(_){
			var foo = "abc";
			function bar(){
				return foo;
			}
			
			delay(_);
			var foo = "xyz";
			return bar;
		}
		
		return test(_)();
	}, "xyz");
})
asyncTest("return undefined", 2, function(){
	evalTest(function f(_){
		function test(_){
			delay(_);
			return;
		}
		
		return test(_);
	}, undefined);
})
asyncTest("futures test", 2, function(){
	evalTest(function f(_){
		function delay2(val, _){
			return delay(_, val);
		}
		
		var a = delay2('a');
		var b = delay2('b');
		var c = delay2('c');
		var d = delay2('d');
		return a(_) + b(_) + d(_) + c(_);
	}, "abdc");
})
asyncTest("last case without break", 2, function(){
	evalTest(function f(_){
		switch (true) {
			case true:
				delay(_);
		}
		return 1;
	}, 1);
})

