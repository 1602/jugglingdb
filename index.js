'use strict';

const { Schema } = require('./lib/schema');
const AbstractClass = require('./lib/model.js');

module.exports = {

    Schema,

    AbstractClass,

    // deprecated api
    loadSchema: function(filename, settings, compound) {
        return require('./legacy-compound-schema-loader')(Schema, filename, settings, compound);
    },

    init: function init(compound) {
        return require('./legacy-compound-init')(compound, Schema, AbstractClass);
    },

    get BaseSQL() {
        return require('./lib/sql');
    },

    get version() {
        return require(
            process.versions.node >= '6'
            ? './package.json'
            : '../package.json'
        ).version;
    },

    get test() {
        return require('./test/common_test');
    }

};

