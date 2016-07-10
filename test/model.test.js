var should = require('./init.js');

var db, Model;

describe('Model', function() {

    before(function() {
        db = getSchema();
        Model = db.define('Model', function(m) {
            m.property('field', String);
        });
    });

    it('should reset prev data on save', function(done) {
        var inst = new Model({field: 'hello'});
        inst.field = 'world';
        inst.save().then(function(s) {
            s.field.should.equal('world');
            s.propertyChanged('field').should.be.false;
            done();
        }).catch(done);
    });

    describe('#toString', function() {

        it('should add model name to stringified representation', function() {
            Model.toString().should.equal('[Model Model]');
        });

    });

});
