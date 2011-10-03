try {
    global.sinon = require('sinon');
} catch (e) {
    // ignore
}

var group_name = false, EXT_EXP;
function it (should, test_case) {
    check_external_exports();
    if (group_name) {
        EXT_EXP[group_name][should] = test_case;
    } else {
        EXT_EXP[should] = test_case;
    }
}

global.it = it;

function context(name, tests) {
    check_external_exports();
    EXT_EXP[name] = {};
    group_name = name;
    tests({
        before: function (f) {
            it('setUp', f);
        },
        after: function (f) {
            it('tearDown', f);
        }
    });
    group_name = false;
}

global.context = context;

exports.init = function (external_exports) {
    EXT_EXP = external_exports;
    if (external_exports.done) {
        external_exports.done();
    }
};

function check_external_exports() {
    if (!EXT_EXP) throw new Error(
        'Before run this, please ensure that ' +
        'require("spec_helper").init(exports); called');
}

// add assertions

var assert = require(require('module')._resolveFilename('nodeunit')[0].replace(/index\.js$/, 'lib/assert'));

// Check response status code 200 OK
assert.status200 = function (response, message) {
    if (response.statusCode !== 200) {
        assert.fail(response.statusCode, 200, message || 'Status code is not 200', '===', assert.status200);
    }
}

// Check redirection
assert.redirect = function (response, path, message) {
    if (response.statusCode !== 302) {
        assert.fail(response.statusCode, 302, 'Status code is not 302', '===', assert.redirect);
    }
    var realPath = require('url').parse(response.headers.location).pathname;
    if (realPath !== path) {
        assert.fail(realPath, path, message || 'Wrong location', '===', assert.redirect);
    }
}

