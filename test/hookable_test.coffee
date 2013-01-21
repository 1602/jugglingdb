juggling = require('../index')
Schema = juggling.Schema
AbstractClass = juggling.AbstractClass
Hookable = juggling.Hookable

require('./spec_helper').init module.exports

schema = new Schema 'memory'
User = schema.define 'User',
    email: String
    name: String
    password: String
    state: String
    age: Number
    gender: String
    domain: String
    pendingPeriod: Number
    createdByAdmin: Boolean

it "should trigger after initialize", (test) ->
    User.afterInitialize = ->
        User.afterInitialize = null
        test.done()
    user = new User
  

it "should trigger before create", (test) ->
    User.beforeCreate = () ->
        User.beforeCreate = null
        test.done()
    User.create -> test.ok "saved"

it "should trigger after create", (test) ->
    User.afterCreate = (next) ->
        User.afterCreate = null
        next()

    User.create ->
        test.ok "saved"
        test.done()

it 'should trigger before save', (test) ->
    test.expect(3)
    User.beforeSave = (next) ->
        User.beforeSave = null
        @name = 'mr. ' + @name
        next()
    user = new User name: 'Jonathan'

    user.save ->
        test.equals User.schema.adapter.cache.User[user.id].name, user.name
        test.equals user.name, 'mr. Jonathan'
        test.ok 'saved'
        test.done()

it 'should trigger after save', (test) ->
    User.afterSave = (next) ->
        User.afterSave = null
        next()

    user = new User
    user.save ->
        test.ok "saved"
        test.done()

it "should trigger before update", (test) ->
    User.beforeUpdate = () ->
        User.beforeUpdate = null
        test.done()
    User.create {}, (err, user) ->
        user.updateAttributes email:"1@1.com", -> test.ok "updated"

it "should trigger after update", (test) ->
    User.afterUpdate = () ->
        User.afterUpdate = null
        test.done()
    User.create (err, user) ->
        user.updateAttributes email: "1@1.com", -> test.ok "updated"

it "should trigger before destroy", (test)->
    User.beforeDestroy = () ->
        User.beforeDestroy = null
        test.done()
    User.create {}, (err, user) ->
        user.destroy()

it "should trigger after destroy", (test) ->
    User.afterDestroy = () ->
        User.afterDestroy = null
        test.done()
    User.create (err, user) ->
        user.destroy()

it 'allows me to modify attributes before saving', (test) ->
    test.expect 4
    User.beforeSave = (next) ->
        @email = @name + '@example.org'
        next()
    # Create initial user
    user = new User name: 'kenneth'
    user.save ->
        # Check that the email was updated by beforeSave
        test.equals user.email, 'kenneth@example.org'
        # Update name
        user.updateAttributes name: 'kennu', ->
            # Check that the email was again updated by beforeSave
            test.equals user.email, 'kennu@example.org'
            User.beforeSave = null
            # Clear cache and reload to check if changes were actually stored in db
            User.constructor.cache = {}
            User.constructor.mru = []
            User.find user.id, (err, loadedUser) ->
                test.equals loadedUser.email, 'kennu@example.org'
                test.ok 'reloaded'
                test.done()

it 'allows me to modify attributes before creating', (test) ->
    test.expect 3
    User.beforeCreate = (next) ->
        @email = @name + '@example.org'
        next()
    User.create name: 'kenneth', (err, user) ->
        # Check that the email was updated by beforeCreate
        test.equals user.email, 'kenneth@example.org'
        User.beforeCreate = null
        # Clear cache and reload to check if changes were actually stored in db
        User.constructor.cache = {}
        User.constructor.mru = []
        User.find user.id, (err, loadedUser) ->
            test.equals loadedUser.email, 'kenneth@example.org'
            test.ok 'reloaded'
            test.done()
