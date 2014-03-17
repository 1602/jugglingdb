// This test written in mocha+should.js
var should = require('./init.js');

var db, Page;

describe('list', function() {

    before(function() {
        db = getSchema();
        Page = db.define('Page', function(m) {
            m.property('widgets', []);
        });
    });

    it('should be exported to json just as "items"', function() {
        var p = new Page({widgets: ['hello']});
        JSON.stringify(p).should.equal(
            '{"widgets":[{"id":"hello"}]}'
        );
    });

    it('should push and remove object', function() {
        var p = new Page({widgets: []});
        p.widgets.push(7);
        JSON.stringify(p.widgets).should.equal('[{"id":7}]');
        p.widgets.remove(7);
        JSON.stringify(p.widgets).should.equal('[]');
    });

    describe('#map', function() {

        it('should collect field', function() {
            var p = new Page({widgets: [{foo: 'bar'}, {foo: 'baz'}]});
            p.widgets.map('foo').should.eql(['bar', 'baz']);
        });

        it('should work as usual js array map', function() {
            var p = new Page({widgets: [{foo: 'bar'}, {foo: 'baz'}]});
            p.widgets.map(function(x) {
                return x.id;
            }).should.eql([1, 2]);
        });

    });

    describe('#find', function() {

        it('should find object', function() {
            var p = new Page({widgets: ['foo', 'bar', 'baz']});
            JSON.stringify(
                p.widgets.find('foo')
            ).should.eql('{"id":"foo"}');
        });

        it('should find object by property', function() {
            var p = new Page({widgets: [{foo: 'bar'}, {foo: 'baz'}]});
            JSON.stringify(
                p.widgets.find('bar', 'foo')
            ).should.eql('{"foo":"bar","id":1}');
        });

    });

    describe("#save", function () {

        it("should save itself to it's parent's parent", function () {
            var p = new Page({widgets: [{foo: 'bar'}, {foo: 'baz'}]});
            p.widgets.find('bar', 'foo').save();
        });

    });

});
