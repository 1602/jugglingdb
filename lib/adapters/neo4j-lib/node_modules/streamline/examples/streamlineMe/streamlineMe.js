var _demo = "\n" +
"\nwindow.demo = function(message, callback) {" +
"\n  if (typeof callback !== 'function')" +
"\n    throw new Error('bad callback: ' + callback);" +
"\n  info(message + ' (waiting 1s)');" +
"\n  setTimeout(function() {" +
"\n    info(message + ' (done!)');" +
"\n    callback(null, message.length);" +
"\n  }, 1000);" +
"\n}" +
"\n";

var _samples = {
	introSample: "" +
	"// Demonstrates how 'streamline.js' transforms synchronous-looking code" +
	"\n// into asynchronous code with callbacks." +
	"\n//" +
	"\n// Try one of the samples above, or write your own code below." +
	"\n// Syntax is simple: just use '_' anywhere a callback is expected" +
	"\n//" +
	"\n// The samples compute factorial(4) by different methods." +
	"\n//" +
	"\n// Look at the transformed code and run it with the 'execute' button." +
	"\n//" +
	"\n// The transformation generates some one-liner auxiliary functions." +
	"\n// Select the 'show complete code' option to see the whole code." +
	"\n//" +
	"\n// The 'beautify' button can help you tidy your code." +
	_demo +
	"\ndemo('Straight to the answer: fact(4) = 24', _);" +
	"\n" +
	"\n// A few pointers to understand the generated code:" +
	"\n//" +
	"\n// * the '_' parameter is the callback. This is where execution will" +
	"\n//   continue on a return or throw statement." +
	"\n// * the '__then' variable is a 'then' callback. This is where execution will" +
	"\n//   resume at the end of the construct if it didn't encounter a return " +
	"\n//   or throw." +
	"\n// * the '__cb' function is just a little callback wrapper that deals with " +
	"\n//   error handling and other small matters in a generic way." +
	"\n// * the '__trap' function handles errors if the callback is missing." +
	"\n",

	sequenceSample: "" +
	"// Multiply one step at a time:" +
	"\n" +
	"\nvar fact = demo('1', _);" +
	"\nfact *= demo('12', _);" +
	"\nfact *= demo('123', _);" +
	"\nfact *= demo('1234', _);" +
	"\ndemo('fact(4) = ' + fact, _);" +
	"\n",

	expressionsSample: "" +
	"// Multiply all at once:" +
	"\n" +
	"\nvar fact = demo('1', _) * demo('12', _) * demo('123', _) * demo('1234', _);" +
	"\ndemo('fact(4) = ' + fact, _)" +
	"\n",

	functionsSample: "" +
	"// Go through intermediate functions: " +
	"\n" +
	"\nfunction f(n1, n2, _) {" +
	"\n  return demo(n1, _) * demo(n2, _);" +
	"\n}" +
	"\n" +
	"\nfunction g(_) {" +
	"\n  return f('1', '12', _) * f('123', '1234', _);" +
	"\n}" +
	"\n" +
	"\ndemo('fact(4) = ' + g(_), _);" +
	"\n",

	ifElseSample: "" +
	"// Natural recursive version with if/else test." +
	"\n" +
	"\nfunction fact(n, _) {" +
	"\n  if (n == 1) { demo('return: 1', _); return 1; }" +
	"\n  else { demo('recurse: ' + n, _); return n * fact(n - 1, _); }" +
	"\n}" +
	"\n" +
	"\ndemo('fact(4) = ' + fact(4, _), _);" +
	"\n",

	loopSample: "" +
	"// Natural iterative version" +
	"\n" +
	"\nfunction fact(n, _) {" +
	"\n  var result = 1;" +
	"\n  for (var str = '-'; str.length <= n; str += '-') {" +
	"\n    result *= demo(str, _);" +
	"\n  }" +
	"\n  return result;" +
	"\n}" +
	"\n" +
	"\ndemo('fact(4) = ' + fact(4, _), _);" +
	"\n",

	tryCatchSample: "" +
	"// Recursive variant with throw/catch." +
	"\n" +
	"\nfunction fact(n, _) {" +
	"\n  try {" +
	"\n    demo('try: n = ' + n, _);" +
	"\n    if (n == 0) throw new Error('zero');" +
	"\n    return n * fact(n - 1, _);" +
	"\n  }" +
	"\n  catch (ex) { demo('caught ' + ex.message, _); return 1; }" +
	"\n  finally { demo('finally: n = ' + n, _); }" +
	"\n}" +
	"\n" +
	"\ndemo('fact(4) = ' + fact(4, _), _);" +
	"\n",

	lazySample: "" +
	"// Variant with lazy eval operators." +
	"\n// Note that fact(3, _) is evaluated but fact(5, _) is not" +
	"\n" +
	"\nfunction fact(n, _) {" +
	"\n  demo('n=' + n, _);" +
	"\n  return n == 1 ? demo('!', _) : n * fact(n - 1, _);" +
	"\n}" +
	"\n" +
	"\nvar fact4 = (fact(3, _) - 6) || fact(4, _) || fact(5, _);" +
	"\n" +
	"\ndemo('fact(4) = ' + fact4, _);" +
	"\n",

	futuresSample: "" +
	"// Variant with futures." +
	"\n// Much faster because all futures wait together" +
	"\n" +
	"\n// Intermediate function to return future when called" +
	"\n// without _ (demo does not return future)" +
	"\nfunction demo2(str, _) { return demo(str, _); }" +
	"\n" +
	"\nvar v1 = demo2('1');" +
	"\nvar v2 = demo2('12');" +
	"\nvar v3 = demo2('123');" +
	"\nvar v4 = demo2('1234');" +
	"\n" +
	"\ndemo2('fact(4) = ' +v1(_) * v2(_) * v3(_) * v4(_));" +
	"\n",
}

var _complete = false;

function error(message) {
	$('#result').removeClass('info').addClass('error').text(message);
}

function info(message) {
	$('#result').removeClass('error').addClass('success').text(message);
}

window.__context = {
	errorHandler: function(err) {
		error(err.message || err.toString());
	}
}

eval(_demo); // define demo if user does not execute intro

function _transform() {
	var codeIn = $('#codeIn').val();
	try {
		var codeOut = Streamline.transform(codeIn, {
			noHelpers: !_complete,
			lines: _complete ? "mark" : "ignore"
		});
		$('#codeOut').val(codeOut);
		info("ready")
	} catch (ex) {
		console.error(ex);
		error(ex.message)
	}
}

function _execute() {
	var codeIn = $('#codeIn').val();
	try {
		var codeOut = Streamline.transform(codeIn, {
			lines: "preserve"
		});
		eval(codeOut);
	} catch (ex) {
		error(ex.message);
	}
}

function _beautify(str) {
	try {
		var str = Narcissus.decompiler.pp(Narcissus.parser.parse(str));
		str = str.replace(/}\s*;/g, "}")
		$('#codeIn').val(str);
		return true;
	} catch (ex) {
		error(ex.message);
		return false;
	}
}

$( function() {
	$('#codeIn').keyup(_transform);
	$('.sample').click( function() {
		$('#codeIn').val(_samples[this.id]);
		_transform();
	});
	$('#beautify').click( function() {
		_beautify($('#codeIn').val());
	})
	$('#complete').change( function() {
		_complete = !_complete;
		_transform();
	})
	$('#execute').click( function() {
		_execute();
	})
	$('#codeIn').val(_samples["introSample"]);
	_transform();
})
