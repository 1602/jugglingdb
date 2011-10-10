exports.Validatable = Validatable;

function Validatable() {
    // validatable class
};

Validatable.validatesPresenceOf = getConfigurator('presence');
Validatable.validatesLengthOf = getConfigurator('length');
Validatable.validatesNumericalityOf = getConfigurator('numericality');
Validatable.validatesInclusionOf = getConfigurator('inclusion');
Validatable.validatesExclusionOf = getConfigurator('exclusion');
Validatable.validatesFormatOf = getConfigurator('format');

function getConfigurator(name) {
    return function () {
        configure(this, name, arguments);
    };
}

Validatable.prototype.isValid = function () {
    var valid = true, inst = this;
    if (!this.constructor._validations) {
        Object.defineProperty(this, 'errors', {
            enumerable: false,
            configurable: true,
            value: false
        });
        return valid;
    }
    Object.defineProperty(this, 'errors', {
        enumerable: false,
        configurable: true,
        value: new Errors
    });
    this.constructor._validations.forEach(function (v) {
        if (validationFailed(inst, v)) {
            valid = false;
        }
    });
    if (valid) {
        Object.defineProperty(this, 'errors', {
            enumerable: false,
            configurable: true,
            value: false
        });
    }
    return valid;
};

function validationFailed(inst, v) {
    var attr = v[0];
    var conf = v[1];
    // here we should check skip validation conditions (if, unless)
    // that can be specified in conf
    var fail = false;
    validators[conf.validation].call(inst, attr, conf, function onerror(kind) {
        var message;
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
            if (message[kind]) {
                // get deeper
                message = message[kind];
            } else if (defaultMessages.common[kind]) {
                message = defaultMessages.common[kind];
            }
        }
        inst.errors.add(attr, message);
        fail = true;
    });
    return fail;
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
    exclusion: 'is reserved'
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

var validators = {
    presence: function (attr, conf, err) {
        if (blank(this[attr])) {
            err();
        }
    },
    length: function (attr, conf, err) {
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
    },
    numericality: function (attr, conf, err) {
        if (nullCheck.call(this, attr, conf, err)) return;

        if (typeof this[attr] !== 'number') {
            return err('number');
        }
        if (conf.int && this[attr] !== Math.round(this[attr])) {
            return err('int');
        }
    },
    inclusion: function (attr, conf, err) {
        if (nullCheck.call(this, attr, conf, err)) return;

        if (!~conf.in.indexOf(this[attr])) {
            err()
        }
    },
    exclusion: function (attr, conf, err) {
        if (nullCheck.call(this, attr, conf, err)) return;

        if (~conf.in.indexOf(this[attr])) {
            err()
        }
    },
    format: function (attr, conf, err) {
        if (nullCheck.call(this, attr, conf, err)) return;

        if (typeof this[attr] === 'string') {
            if (!this[attr].match(conf['with'])) {
                err();
            }
        } else {
            err();
        }
    }
};

function blank(v) {
    if (typeof v === 'undefined') return true;
    if (v instanceof Array && v.length === 0) return true;
    if (v === null) return true;
    if (typeof v == 'string' && v === '') return true;
    return false;
}

function configure(class, validation, args) {
    if (!class._validations) {
        Object.defineProperty(class, '_validations', {
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
    conf.validation = validation;
    args.forEach(function (attr) {
        class._validations.push([attr, conf]);
    });
}

function Errors() {
}

Errors.prototype.add = function (field, message) {
    if (!this[field]) {
        this[field] = [message];
    } else {
        this[field].push(message);
    }
};
