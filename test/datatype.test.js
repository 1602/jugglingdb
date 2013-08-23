// This test written in mocha+should.js
var should = require('./init.js');

var db, Model;

describe('datatypes', function() {

    before(function(done){
        db = getSchema();
        Model = db.define('Model', {
            str: String,
            date: Date,
            num: Number,
            bool: Boolean,
            list: {type: []},
        });
        db.automigrate(function() {
            Model.destroyAll(done);
        });
    });

    it('should keep types when get read data from db', function(done) {
        var d = new Date, id;

        Model.create({
            str: 'hello', date: d, num: '3', bool: 1, list: ['test']
        }, function(err, m) {
            should.not.exist(err);
            should.exist(m && m.id);
            m.str.should.be.a('string');
            m.num.should.be.a('number');
            m.bool.should.be.a('boolean');
            id = m.id;
            testFind(testAll);
        });

        function testFind(next) {
            Model.find(id, function(err, m) {
                should.not.exist(err);
                should.exist(m);
                m.str.should.be.a('string');
                m.num.should.be.a('number');
                m.bool.should.be.a('boolean');
                m.date.should.be.an.instanceOf(Date);
                m.date.toString().should.equal(d.toString(), 'Time must match');
                next();
            });
        }

        function testAll() {
            Model.findOne(function(err, m) {
                should.not.exist(err);
                should.exist(m);
                m.str.should.be.a('string');
                m.num.should.be.a('number');
                m.bool.should.be.a('boolean');
                m.date.should.be.an.instanceOf(Date);
                m.date.toString().should.equal(d.toString(), 'Time must match');
                done();
            });
        }

    });

    it('should convert "false" to false for boolean', function() {
        var m = new Model({bool: 'false'});
        m.bool.should.equal(false);
    });

});
