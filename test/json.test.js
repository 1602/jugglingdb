// This test written in mocha+should.js
var should = require('./init.js');

var Schema = require('../').Schema;

describe('JSON property', function() {
    var schema, Model;

    it('should be defined', function() {
        schema = getSchema();
        Model = schema.define('Model', {propertyName: Schema.JSON});
        var m = new Model;
        (new Boolean('propertyName' in m)).should.eql(true);
        should.not.exist(m.propertyName);
    });

    it('should accept JSON in constructor and return object', function() {
        var m = new Model({
            propertyName: '{"foo": "bar"}'
        });
        m.propertyName.should.be.an.Object;
        m.propertyName.foo.should.equal('bar');
    });

    it('should accept object in setter and return object', function() {
        var m = new Model;
        m.propertyName = {"foo": "bar"};
        m.propertyName.should.be.an.Object;
        m.propertyName.foo.should.equal('bar');
    });

    it('should accept string in setter and return string', function() {
        var m = new Model;
        m.propertyName = '{"foo": "bar"}';
        m.propertyName.should.be.a.String;
        m.propertyName.should.equal('{"foo": "bar"}');
    });
});
