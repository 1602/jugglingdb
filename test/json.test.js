// This test written in mocha+should.js
const should = require('./init.js');

const Schema = require('../').Schema;

describe('JSON property', function() {
    let schema, Model;

    it('should be defined', function() {
        schema = getSchema();
        Model = schema.define('Model', { propertyName: Schema.JSON });
        const m = new Model;
        (new Boolean('propertyName' in m)).should.eql(true);
        should.not.exist(m.propertyName);
    });

    it('should accept JSON in constructor and return object', function() {
        const m = new Model({
            propertyName: '{"foo": "bar"}'
        });
        m.propertyName.should.be.an.Object;
        m.propertyName.foo.should.equal('bar');
    });

    it('should accept object in setter and return object', function() {
        const m = new Model;
        m.propertyName = { 'foo': 'bar' };
        m.propertyName.should.be.an.Object;
        m.propertyName.foo.should.equal('bar');
    });

    it('should accept string in setter and return string', function() {
        const m = new Model;
        m.propertyName = '{"foo": "bar"}';
        m.propertyName.should.be.a.String;
        m.propertyName.should.equal('{"foo": "bar"}');
    });
});
