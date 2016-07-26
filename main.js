var isNodeSix = process.versions.node >= '6';

if (!isNodeSix) {
    global.Promise = require('when').Promise;
}

module.exports = isNodeSix
    ? require('./index')
    : require('./build/index');


