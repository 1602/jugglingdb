var Schema = require('jugglingdb').Schema;
var should = require('should');

describe('JSON property', function() {
    var schema, Model;

    it('could be defined', function() {
        schema = new Schema('memory');
        Model = schema.define('Model', {propertyName: Schema.JSON});
        var m = new Model;
        m.should.have.property('propertyName');
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
