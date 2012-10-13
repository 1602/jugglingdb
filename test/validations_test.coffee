juggling = require('../index')
Schema = juggling.Schema
AbstractClass = juggling.AbstractClass
Validatable = juggling.Validatable

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
    createdByScript: Boolean
    updatedAt: Date

validAttributes =
    name: 'Anatoliy'
    email: 'email@example.com'
    state: ''
    age: 26
    gender: 'male'
    domain: '1602'
    createdByAdmin: false
    createdByScript: true

getValidAttributes = ->
    name: 'Anatoliy'
    email: 'email@example.com'
    state: ''
    age: 26
    gender: 'male'
    domain: '1602'
    createdByAdmin: false
    createdByScript: true

it 'should validate presence', (test) ->
    User.validatesPresenceOf 'email', 'name'

    user = new User
    test.ok not user.isValid(), 'User is not valid'
    test.ok user.errors.email, 'Attr email in errors'
    test.ok user.errors.name, 'Attr name in errors'

    user.name = 'Anatoliy'
    test.ok not user.isValid(), 'User is still not valid'
    test.ok user.errors.email, 'Attr email still in errors'
    test.ok not user.errors.name, 'Attr name valid'

    user.email = 'anatoliy@localhost'
    test.ok user.isValid(), 'User is valid'
    test.ok not user.errors, 'No errors'
    test.ok not user.errors.email, 'Attr email valid'
    test.ok not user.errors.name, 'Attr name valid'
    test.done()

it 'should allow to skip validations', (test) ->
    User.validatesPresenceOf 'pendingPeriod', if: 'createdByAdmin'
    User.validatesLengthOf 'domain', is: 2, unless: 'createdByScript'

    user = new User validAttributes
    test.ok user.isValid()

    user.createdByAdmin = true
    test.ok not user.isValid()
    test.ok user.errors.pendingPeriod.length

    user.pendingPeriod = 1
    test.ok user.isValid()

    user.createdByScript = false
    test.ok not user.isValid()
    test.ok user.errors.domain.length

    user.domain = '12'
    test.ok user.isValid()

    User.validatesLengthOf 'domain', is: 3, unless: -> @domain != 'xyz'
    test.ok user.isValid()

    user.domain = 'xyz'
    test.ok not user.isValid() # is: 3 passed, but is: 2 failed

    test.done()

