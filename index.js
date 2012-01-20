exports.Schema = require('./lib/schema').Schema;
exports.AbstractClass = require('./lib/abstract-class').AbstractClass;
exports.Validatable = require('./lib/validatable').Validatable;

try {
    if (process.versions.node < '0.6' || true) {
        exports.version = JSON.parse(fs.readFileSync(process.cwd() + '/package.json')).version;
    } else {
        exports.version = require('../package').version;
    }
} catch(e) {}
