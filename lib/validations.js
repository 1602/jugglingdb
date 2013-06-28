/**
 * Module exports
 */
exports.ValidationError = ValidationError;

/**
 * Validation mixins for model.js
 *
 * Basically validation configurators is just class methods, which adds validations
 * configs to AbstractClass._validations. Each of this validations run when
 * `obj.isValid()` method called.
 *
 * Each configurator can accept n params (n-1 field names and one config). Config
 * is {Object} depends on specific validation, but all of them has one common part:
 * `message` member. It can be just string, when only one situation possible,
 * e.g. `Post.validatesPresenceOf('title', { message: 'can not be blank' });`
 *
 * In more complicated cases it can be {Hash} of messages (for each case):
 * `User.validatesLengthOf('password', { min: 6, max: 20, message: {min: 'too short', max: 'too long'}});`
 */
var Validatable = require('./model.js');

/**
 * Validate presence. This validation fails when validated field is blank.
 * 
 * Default error message "can't be blank"
 *
 * @example presence of title
 * ```
 * Post.validatesPresenceOf('title');
 * ```
 * @example with custom message
 * ```
 * Post.validatesPresenceOf('title', {message: 'Can not be blank'});
 * ```
 *
 * @sync
 *
 * @nocode
 * @see helper/validatePresence
 */
Validatable.validatesPresenceOf = getConfigurator('presence');

/**
 * Validate length. Three kinds of validations: min, max, is.
 *
 * Default error messages:
 *
 * - min: too short
 * - max: too long
 * - is:  length is wrong
 *
 * @example length validations
 * ```
 * User.validatesLengthOf('password', {min: 7});
 * User.validatesLengthOf('email', {max: 100});
 * User.validatesLengthOf('state', {is: 2});
 * User.validatesLengthOf('nick', {min: 3, max: 15});
 * ```
 * @example length validations with custom error messages
 * ```
 * User.validatesLengthOf('password', {min: 7, message: {min: 'too weak'}});
 * User.validatesLengthOf('state', {is: 2, message: {is: 'is not valid state name'}});
 * ```
 *
 * @sync
 * @nocode
 * @see helper/validateLength
 */
Validatable.validatesLengthOf = getConfigurator('length');

/**
 * Validate numericality.
 *
 * @example
 * ```
 * User.validatesNumericalityOf('age', { message: { number: '...' }});
 * User.validatesNumericalityOf('age', {int: true, message: { int: '...' }});
 * ```
 *
 * Default error messages:
 *
 * - number: is not a number
 * - int: is not an integer
 *
 * @sync
 * @nocode
 * @see helper/validateNumericality
 */
Validatable.validatesNumericalityOf = getConfigurator('numericality');

/**
 * Validate inclusion in set
 *
 * @example 
 * ```
 * User.validatesInclusionOf('gender', {in: ['male', 'female']});
 * User.validatesInclusionOf('role', {
 *     in: ['admin', 'moderator', 'user'], message: 'is not allowed'
 * });
 * ```
 *
 * Default error message: is not included in the list
 *
 * @sync
 * @nocode
 * @see helper/validateInclusion
 */
Validatable.validatesInclusionOf = getConfigurator('inclusion');

/**
 * Validate exclusion
 *
 * @example `Company.validatesExclusionOf('domain', {in: ['www', 'admin']});`
 *
 * Default error message: is reserved
 *
 * @nocode
 * @see helper/validateExclusion
 */
Validatable.validatesExclusionOf = getConfigurator('exclusion');

/**
 * Validate format
 *
 * Default error message: is invalid
 *
 * @nocode
 * @see helper/validateFormat
 */
Validatable.validatesFormatOf = getConfigurator('format');

/**
 * Validate using custom validator
 *
 * Default error message: is invalid
 *
 * Example:
 *
 *     User.validate('name', customValidator, {message: 'Bad name'});
 *     function customValidator(err) {
 *         if (this.name === 'bad') err();
 *     });
 *     var user = new User({name: 'Peter'});
 *     user.isValid(); // true
 *     user.name = 'bad';
 *     user.isValid(); // false
 *
 * @nocode
 * @see helper/validateCustom
 */
Validatable.validate = getConfigurator('custom');

/**
 * Validate using custom async validator
 *
 * Default error message: is invalid
 *
 * Example:
 *
 *     User.validateAsync('name', customValidator, {message: 'Bad name'});
 *     function customValidator(err, done) {
 *         process.nextTick(function () {
 *             if (this.name === 'bad') err();
 *             done();
 *         });
 *     });
 *     var user = new User({name: 'Peter'});
 *     user.isValid(); // false (because async validation setup)
 *     user.isValid(function (isValid) {
 *         isValid; // true
 *     })
 *     user.name = 'bad';
 *     user.isValid(); // false
 *     user.isValid(function (isValid) {
 *         isValid; // false
 *     })
 *
 * @async
 * @nocode
 * @see helper/validateCustom
 */
Validatable.validateAsync = getConfigurator('custom', {async: true});

/**
 * Validate uniqueness
 *
 * Default error message: is not unique
 *
 * @async
 * @nocode
 * @see helper/validateUniqueness
 */
Validatable.validatesUniquenessOf = getConfigurator('uniqueness', {async: true});

// implementation of validators

/**
 * Presence validator
 */
function validatePresence(attr, conf, err) {
    if (blank(this[attr])) {
        err();
    }
}

/**
 * Length validator
 */
function validateLength(attr, conf, err) {
    if (nullCheck.call(this, attr, conf, err)) return;

    var len = this[attr].length;
    if (conf.min && len < conf.min) {
        err('min');
    }
    if (conf.max && len > conf.max) {
        err('max');
    }
    if (conf.is && len !== conf.is) {
        err('is');
    }
}

/**
 * Numericality validator
 */
function validateNumericality(attr, conf, err) {
    if (nullCheck.call(this, attr, conf, err)) return;

    if (typeof this[attr] !== 'number') {
        return err('number');
    }
    if (conf.int && this[attr] !== Math.round(this[attr])) {
        return err('int');
    }
}

/**
 * Inclusion validator
 */
function validateInclusion(attr, conf, err) {
    if (nullCheck.call(this, attr, conf, err)) return;

    if (!~conf.in.indexOf(this[attr])) {
        err()
    }
}

/**
 * Exclusion validator
 */
function validateExclusion(attr, conf, err) {
    if (nullCheck.call(this, attr, conf, err)) return;

    if (~conf.in.indexOf(this[attr])) {
        err()
    }
}

/**
 * Format validator
 */
function validateFormat(attr, conf, err) {
    if (nullCheck.call(this, attr, conf, err)) return;

    if (typeof this[attr] === 'string') {
        if (!this[attr].match(conf['with'])) {
            err();
        }
    } else {
        err();
    }
}

/**
 * Custom validator
 */
function validateCustom(attr, conf, err, done) {
    conf.customValidator.call(this, err, done);
}

/**
 * Uniqueness validator
 */
function validateUniqueness(attr, conf, err, done) {
    if (nullCheck.call(this, attr, conf, err)) {
        return done();
    }

    var cond = {where: {}};
    cond.where[attr] = this[attr];
    this.constructor.all(cond, function (error, found) {
        if (error) {
            return err();
        }
        if (found.length > 1) {
            err();
        } else if (found.length === 1 && (!this.id || !found[0].id || found[0].id.toString() != this.id.toString())) {
            err();
        }
        done();
    }.bind(this));
}

var validators = {
    presence:     validatePresence,
    length:       validateLength,
    numericality: validateNumericality,
    inclusion:    validateInclusion,
    exclusion:    validateExclusion,
    format:       validateFormat,
    custom:       validateCustom,
    uniqueness:   validateUniqueness
};

function getConfigurator(name, opts) {
    return function () {
        configure(this, name, arguments, opts);
    };
}

/**
 * This method performs validation, triggers validation hooks.
 * Before validation `obj.errors` collection cleaned.
 * Each validation can add errors to `obj.errors` collection.
 * If collection is not blank, validation failed.
 *
 * @warning This method can be called as sync only when no async validation
 * configured. It's strongly recommended to run all validations as asyncronous.
 *
 * @param {Function} callback called with (valid)
 * @return {Boolean} true if no async validation configured and all passed
 *
 * @example ExpressJS controller: render user if valid, show flash otherwise
 * ```
 * user.isValid(function (valid) {
 *     if (valid) res.render({user: user});
 *     else res.flash('error', 'User is not valid'), console.log(user.errors), res.redirect('/users');
 * });
 * ```
 */
Validatable.prototype.isValid = function (callback, data) {
    var valid = true, inst = this, wait = 0, async = false;

    // exit with success when no errors
    if (!this.constructor._validations) {
        cleanErrors(this);
        if (callback) {
            this.trigger('validate', function (validationsDone) {
                validationsDone.call(inst, function() {
                    callback(valid);
                });
            });
        }
        return valid;
    }

    Object.defineProperty(this, 'errors', {
        enumerable: false,
        configurable: true,
        value: new Errors
    });

    this.trigger('validate', function (validationsDone) {
        var inst = this,
            asyncFail = false;

        this.constructor._validations.forEach(function (v) {
            if (v[2] && v[2].async) {
                async = true;
                wait += 1;
                process.nextTick(function () {
                    validationFailed(inst, v, done);
                });
            } else {
                if (validationFailed(inst, v)) {
                    valid = false;
                }
            }

        });

        if (!async) {
            validationsDone.call(inst, function() {
                if (valid) cleanErrors(inst);
                if (callback) {
                    callback(valid);
                }
            });
        }

        function done(fail) {
            asyncFail = asyncFail || fail;
            if (--wait === 0) {
                validationsDone.call(inst, function () {
                    if (valid && !asyncFail) cleanErrors(inst);
                    if (callback) {
                        callback(valid && !asyncFail);
                    }
                });
            }
        }

    }, data);

    if (async) {
        // in case of async validation we should return undefined here,
        // because not all validations are finished yet
        return;
    } else {
        return valid;
    }

};

function cleanErrors(inst) {
    Object.defineProperty(inst, 'errors', {
        enumerable: false,
        configurable: true,
        value: false
    });
}

function validationFailed(inst, v, cb) {
    var attr = v[0];
    var conf = v[1];
    var opts = v[2] || {};

    if (typeof attr !== 'string') return false;

    // here we should check skip validation conditions (if, unless)
    // that can be specified in conf
    if (skipValidation(inst, conf, 'if')) return false;
    if (skipValidation(inst, conf, 'unless')) return false;

    var fail = false;
    var validator = validators[conf.validation];
    var validatorArguments = [];
    validatorArguments.push(attr);
    validatorArguments.push(conf);
    validatorArguments.push(function onerror(kind) {
        var message, code = conf.validation;
        if (conf.message) {
            message = conf.message;
        }
        if (!message && defaultMessages[conf.validation]) {
            message = defaultMessages[conf.validation];
        }
        if (!message) {
            message = 'is invalid';
        }
        if (kind) {
            code += '.' + kind;
            if (message[kind]) {
                // get deeper
                message = message[kind];
            } else if (defaultMessages.common[kind]) {
                message = defaultMessages.common[kind];
            } else {
                message = 'is invalid';
            }
        }
        inst.errors.add(attr, message, code);
        fail = true;
    });
    if (cb) {
        validatorArguments.push(function () {
            cb(fail);
        });
    }
    validator.apply(inst, validatorArguments);
    return fail;
}

function skipValidation(inst, conf, kind) {
    var doValidate = true;
    if (typeof conf[kind] === 'function') {
        doValidate = conf[kind].call(inst);
        if (kind === 'unless') doValidate = !doValidate;
    } else if (typeof conf[kind] === 'string') {
        if (typeof inst[conf[kind]] === 'function') {
            doValidate = inst[conf[kind]].call(inst);
            if (kind === 'unless') doValidate = !doValidate;
        } else if (inst.__data.hasOwnProperty(conf[kind])) {
            doValidate = inst[conf[kind]];
            if (kind === 'unless') doValidate = !doValidate;
        } else {
            doValidate = kind === 'if';
        }
    }
    return !doValidate;
}

var defaultMessages = {
    presence: 'can\'t be blank',
    length: {
        min: 'too short',
        max: 'too long',
        is: 'length is wrong'
    },
    common: {
        blank: 'is blank',
        'null': 'is null'
    },
    numericality: {
        'int': 'is not an integer',
        'number': 'is not a number'
    },
    inclusion: 'is not included in the list',
    exclusion: 'is reserved',
    uniqueness: 'is not unique'
};

function nullCheck(attr, conf, err) {
    var isNull = this[attr] === null || !(attr in this);
    if (isNull) {
        if (!conf.allowNull) {
            err('null');
        }
        return true;
    } else {
        if (blank(this[attr])) {
            if (!conf.allowBlank) {
                err('blank');
            }
            return true;
        }
    }
    return false;
}

/**
 * Return true when v is undefined, blank array, null or empty string
 * otherwise returns false
 *
 * @param {Mix} v
 * @returns {Boolean} whether `v` blank or not
 */
function blank(v) {
    if (typeof v === 'undefined') return true;
    if (v instanceof Array && v.length === 0) return true;
    if (v === null) return true;
    if (typeof v == 'string' && v === '') return true;
    return false;
}

function configure(cls, validation, args, opts) {
    if (!cls._validations) {
        Object.defineProperty(cls, '_validations', {
            writable: true,
            configurable: true,
            enumerable: false,
            value: []
        });
    }
    args = [].slice.call(args);
    var conf;
    if (typeof args[args.length - 1] === 'object') {
        conf = args.pop();
    } else {
        conf = {};
    }
    if (validation === 'custom' && typeof args[args.length - 1] === 'function') {
        conf.customValidator = args.pop();
    }
    conf.validation = validation;
    args.forEach(function (attr) {
        cls._validations.push([attr, conf, opts]);
    });
}

function Errors() {
    Object.defineProperty(this, 'codes', {
        enumerable: false,
        configurable: true,
        value: {}
    });
}

Errors.prototype.add = function (field, message, code) {
    code = code || 'invalid';
    if (!this[field]) {
        this[field] = [];
        this.codes[field] = [];
    }
    this[field].push(message);
    this.codes[field].push(code);
};

function ErrorCodes(messages) {
    var c = this;
    Object.keys(messages).forEach(function(field) {
        c[field] = messages[field].codes;
    });
}

function ValidationError(obj) {
    if (!(this instanceof ValidationError)) return new ValidationError(obj);

    this.name = 'ValidationError';
    this.message = 'Validation error';
    this.statusCode = 400;
    this.codes = obj.errors && obj.errors.codes;
    this.context = obj && obj.constructor && obj.constructor.modelName;

    Error.call(this);
};

ValidationError.prototype.__proto__ = Error.prototype;
