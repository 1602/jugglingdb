## streamline.js

`streamline.js` is a small tool to simplify asynchronous Javascript programming.

Instead of writing hairy code like:

```javascript
function lineCount(path, callback) {
  fs.readFile(path, "utf8", function(err, data) {
    if (err) { callback(err); return; }
    callback(null, data.split('\n').length);
  });
}
```
Streamline.js lets you write:

```javascript
function lineCount(path, _) {
  return fs.readFile(path, "utf8", _).split('\n').length;
}
```
You just have to follow a simple rule:

> Replace all callbacks by an underscore and write your code as if all functions were synchronous.

Streamline will transform the code and generate the callbacks for you!

And streamline is not limited to a subset of Javascript. 
You can use all the flow control features of Javascript in your asynchronous code: conditionals, 
loops, `try/catch/finally` blocks, anonymous functions, `this`, etc. 

Streamline generates more or less the callbacks that you would write yourself. So you get the same level
of performance as with hand-written callbacks. 
Also, the generated code is nicely indented, easy to read, and directly available to debuggers.

Streamline also provides _futures_, and comes with a small optional library of helper functions (see Goodies section below).

# On-line demo

You can test `streamline.js` directly with the [on-line demo](http://sage.github.com/streamlinejs/examples/streamlineMe/streamlineMe.html)

# Installation

The easiest way to install `streamline.js` is with NPM:

```sh
npm install streamline -g
```

The `-g` option installs it _globally_.
You can also install it _locally_, without `-g` but then the `node-streamline` and `coffee-streamline` 
commands will not be in your default PATH.

Note: if you encounter a permission error when installing on UNIX systems, you should retry with `sudo`.
    
# Creating and running streamline modules

To create a module called `myModule`, put your _streamlined_ source in a file called `myModule_.js`.

Then you have several options:

1. You can _compile_ your module with `node-streamline -c`. This will create a file called `myModule.js` that you can directly run with the `node` command,
or _require_ from a normal node program.
2. You can run the module with `node-streamline myModule_` or require it as `require('myModule_')` from a program that you launch with `node-streamline`. 
If you choose this option, the `myModule.js` file will not be created.
3. You can run the module with `node-streamline myModule` or require it as `require('myModule')` from a program that you launch with `node-streamline`. 
If you choose this option, you have to create an empty `myModule.js` file to initiate the process.
4. You can load source and transform it _on the fly_ with the `transform` API.

Option 1 is ideal for production code, as your transformed module will be loaded standalone. The transformation engine will not be loaded.

Option 2 is your best option if you do not want to save the transformed code to disk.

Option 3 is ideal for the development phase if you do not have a build script. 
The files will only be recompiled if the source has changed (so you won't get the overhead every time you launch your program).
The transformed source will be available on disk, and will be loaded by the debugger (because you require `myModule`, not `myModule_`).
Also, this option makes the switch to production really easy: recompile the whole tree and run with `node` rather than with `node-streamline`.

Option 4 is reserved for advanced scenarios where the code is transformed on the fly.

There is an alternative to running your application with `node-streamline`: 
you can call `require('streamline')` from your main script and then run it with `node`. 
Modules that are required (directly or indirectly) by your main script will be transformed on demand.

Note: streamline can also transform vanilla Javascript files that don't use CommonJS modules and don't target node. 
So you can compile them (option 1) and load them directly in the browser from a `<script>` directive.

# Examples

The `examples/diskUsage` directory contains a simple example that traverses directories to compute disk usage.
You can run as follows:

```sh
node-streamline diskUsage_ (will not regenerate diskUsage.js)
node-streamline diskUsage (will regenerate diskUsage.js if necessary)
node diskUsage (assumes that diskUsage.js is there and up-to-date)
```

# Interoperability with standard node.js code

You can call standard node functions from streamline code. For example the `fs.readFile` function:

```javascript
function lineCount(path, _) {
  return fs.readFile(path, "utf8", _).split('\n').length;
}
```
You can also call streamline functions as if they were standard node functions. For example:

```javascript
lineCount("README.md", function(err, result) {
  if (err) return console.error("ERROR: " + err.message);
  console.log("README has " + result + " lines.");
});
```
And you can mix streamline functions, classical callback based code and synchrononous functions in the same file. 
Streamline will only transform the functions that have the special `_` parameter. The other functions will end up unmodified in the output file (maybe slightly reformatted by the narcissus pretty printer though).

# Running in other environments

`streamline.js` generates vanilla Javascript code that may be run browser-side too.

You can also transform the code in the browser with the `transform` API. See the `test/*.js` unit test files for examples.

You can also use `streamline.js` with CoffeeScript. For example:

```sh
coffee-streamline diskUsage_.coffee
```

See the [Compilers wiki page](https://github.com/Sage/streamlinejs/wiki/Compilers) for details.

# Goodies

The functions generated by streamline return a _future_ if you call them without a callback. 
This gives you an easy way to run several asynchronous operations in parallel and resynchronize later. 
See the [futures](https://github.com/Sage/streamlinejs/wiki/Futures) wiki page for details.

The following subdirectories contain various modules that have been written with streamline.js:

* `lib/util`: utilities for array manipulation, semaphores, etc.
* `lib/streams`: pull-mode API for node.js streams.
* `lib/require`: infrastructure to support client-side require.
* `lib/tools`: small tools (doc generator for API.md file).

## Resources

The API is documented [here](https://github.com/Sage/streamlinejs/blob/master/API.md).  
The [wiki](https://github.com/Sage/streamlinejs/wiki) discusses advanced topics like exception handling.

For support and discussion, please join the [streamline.js Google Group](http://groups.google.com/group/streamlinejs).

## License

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).
