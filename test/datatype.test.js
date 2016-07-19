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
            bool: Boolean
        });
        db.automigrate(function() {
            Model.destroyAll(done);
        });
    });

    it('should keep types when get read data from db', function() {
        var d = new Date, id;

        d.setMilliseconds(0);

        return Model.create({
            str: 'hello',
            date: d,
            num: '3',
            bool: 1
        })
            .then(m => {
                should.exist(m && m.id);
                m.str.should.be.a.String;
                m.num.should.be.a.Number;
                m.bool.should.be.a.Boolean;
                id = m.id;
                return Model.find(id);
            })
            .then(m => {
                should.exist(m);
                m.str.should.be.a.String;
                m.num.should.be.a.Number;
                m.bool.should.be.a.Boolean;
                m.date.should.be.an.instanceOf(Date);
                m.date.toString().should.equal(d.toString(), 'Time must match');
                return Model.findOne();
            })
            .then(m => {
                should.exist(m);
                m.str.should.be.a.String;
                m.num.should.be.a.Number;
                m.bool.should.be.a.Boolean;
                m.date.should.be.an.instanceOf(Date);
                m.date.toString().should.equal(d.toString(), 'Time must match');
            });
    });

    it('should convert "false" to false for boolean', function() {
        var m = new Model({bool: 'false'});
        m.bool.should.equal(false);
    });

});
