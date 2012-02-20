exports.safeRequire = safeRequire;

function safeRequire(module) {
    try {
        return require(module);
    } catch (e) {
        console.log('Run "npm install ' + module + '" command to use jugglingdb using this database engine');
        process.exit(1);
    }
}

