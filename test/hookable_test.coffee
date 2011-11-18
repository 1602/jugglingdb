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

it "should trigger after initialize", (test)->
  User.afterInitialize = ()->
    User.afterInitialize = null
    test.done()
  user = new User
  

it "should trigger before create", (test)->
  User.beforeCreate = ()->
    User.beforeCreate = null
    test.done()
  User.create {}, ()-> test.ok "saved"

it "should trigger after create", (test)->
  User.afterCreate = ()->
    User.afterCreate = null
    test.done()
  User.create {}, ()-> test.ok "saved"

it "should trigger before save", (test)->
  User.beforeSave = ()->
    User.beforeSave = null
    test.done()
  user = new User
  user.save ()-> test.ok "saved"

it "should trigger after save", (test)->
  User.afterSave = ()->
    User.afterSave = null
    test.done()
  user = new User
  user.save ()-> test.ok "saved"

it "should trigger before update", (test)->
  User.beforeUpdate = ()->
    User.beforeUpdate = null
    test.done()
  User.create {}, (err, user)->
    user.updateAttributes {email:"1@1.com"}, ()-> test.ok "updated"

it "should trigger after update", (test)->
  User.afterUpdate = ()->
    User.afterUpdate = null
    test.done()
  User.create {}, (err, user)->
    user.updateAttributes {email:"1@1.com"}, ()-> test.ok "updated"

it "should trigger before destroy", (test)->
  User.beforeDestroy = ()->
    User.beforeDestroy = null
    test.done()
  User.create {}, (err, user)->
    user.destroy()

it "should trigger after destroy", (test)->
  User.afterDestroy = ()->
    User.afterDestroy = null
    test.done()
  User.create {}, (err, user)->
    user.destroy()

