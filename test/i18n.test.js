var should = require('./init.js'), db, User;

describe.only('i18n', function() {
    db = getSchema();

    before(function() {

        User = db.define('User', {
            email: {type: String, index: true, limit: 100},
            name: String
        });

        User.i18n = {
            en: {
                validation: {
                    name: {
                        presence: 'User name is not present'
                    },
                    email: {
                        presence: 'Email required',
                        uniqueness: 'Email already taken'
                    }
                }
            },
            ru: {
                validation: {
                    name: {
                    },
                    email: {
                        presence: 'Электропочта надо',
                        uniqueness: 'Электропочта уже взят'
                    }
                }
            }
        };

        User.validatesUniquenessOf('email');
        User.validatesPresenceOf('name', 'email');
    });

    it('should hook up localized string', function() {
        User.create({email: 'John.Doe@example.com', name: 'John Doe'}, function(err, user) {
        User.create({email: 'John.Doe@example.com'}, function(err, user) {
            console.log(user.errors.__localize('ru'));
            console.log(err);
        });
        });
    });
});
