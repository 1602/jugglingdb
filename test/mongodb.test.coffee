Schema = require('../').Schema
should = require 'should'
db     = new Schema 'mongodb', url: 'mongodb://localhost/jugglingdb'

describe 'mongodb', ->
    List = null
    Todo = null
    ListLocal = null

    before ->
        List = db.define 'List', 
            title: 
                type: String
            TodoId: 
                type: Number

        Todo = db.define 'Todo',
            title:
                type: String

        List.belongsTo Todo, as: 'categorized', foreignKey: 'TodoId'


    it 'should set Todo relation', (done) ->
        Todo.create title: 'Funny list', (err, oTodo) ->
            (oTodo instanceof Todo).should.ok
            (oTodo.title).should.equal 'Funny list'
            
            List.create title: 'Drink with friends', TodoId: oTodo.id, (err, oList) ->
                (oList instanceof List).should.ok
                (oList.title).should.equal 'Drink with friends', 'The title of my todo is done'

                ListLocal = oList
                done()

    it 'should get Todo relation', (done) ->
        ListLocal.categorized (err, obj) ->
            (!err).should.ok
            
            done()