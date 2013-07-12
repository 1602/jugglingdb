exports.safeRequire = safeRequire;

function safeRequire(module) {
    try {
        return require(module);
    } catch (e) {
        console.log('Run "npm install jugglingdb ' + module + '" command to use jugglingdb using ' + module + ' database engine');
        process.exit(1);
    }
}


exports.extend = extend;

function extend(target) {
    var sources = [].slice.call(arguments, 1);
    sources.forEach(function (source) {
        for (var prop in source) {
            target[prop] = source[prop];
        }
    });
    return target;
}
