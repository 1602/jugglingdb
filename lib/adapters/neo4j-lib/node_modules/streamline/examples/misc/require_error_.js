// require_error_.js
// Simple test script that simulates an asynchronous wait and then throws an
// error from a particular line, while specifying partial options. Tests
// Streamline's default "lines preserve" option when running or require()-ing
// files rather than compiling them.
//
// Usage:
// node require.js
// -or-
// node-streamline require_error_.js
//
// This is important: it shouldn't override/reset the "lines preserve" option.
// streamline.options = { "callback": "_wait" }

// simulate async step:
setTimeout(_wait, 1000);

// pretend there's a bunch more code here:
// ...
// ...
// ...

// then throw an error from this line:
console.log("the next error should be reported from line 25!");
undefined.true;     // this should be line 25
