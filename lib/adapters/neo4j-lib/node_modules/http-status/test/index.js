var assert = require('assert'),
    HTTPStatus = require('../lib/index');

module.exports = {
    'Test HTTP Status Code': function () {
        assert.eql(200, HTTPStatus.OK);
        assert.eql('OK', HTTPStatus[200]);
    }
};
