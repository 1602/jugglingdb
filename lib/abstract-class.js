/**
 * Abstract class constructor
 */
function AbstractClass(data) {
    var self = this;
    var ds = this.constructor.schema.definitions[this.constructor.modelName];
    var properties = ds.properties;
    var settings = ds.setings;
    data = data || {};

    if (data.id) {
        defineReadonlyProp(this, 'id', data.id);
    }

    Object.defineProperty(this, 'cachedRelations', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    Object.keys(properties).forEach(function (attr) {
        var _attr    = '_' + attr,
        attr_was = attr + '_was';

        // Hidden property to store currrent value
        Object.defineProperty(this, _attr, {
            writable: true,
            enumerable: false,
            configurable: true,
            value: isdef(data[attr]) ? data[attr] :
                (isdef(this[attr]) ? this[attr] : null)
        });

        // Public setters and getters
        Object.defineProperty(this, attr, {
            get: function () {
                return this[_attr];
            },
            set: function (value) {
                this[_attr] = value;
            },
            configurable: true,
            enumerable: true
        });

        // Getter for initial property
        Object.defineProperty(this, attr_was, {
            writable: true,
            value: data[attr],
            configurable: true,
            enumerable: false
        });

    }.bind(this));
};

/**
 * @param data [optional]
 * @param callback(err, obj)
 */
AbstractClass.create = function (data) {
    var modelName = this.modelName;

    // define callback manually
    var callback = arguments[arguments.length - 1];
    if (arguments.length == 0 || data === callback) {
        data = {};
    }

    if (typeof callback !== 'function') {
        callback = function () {};
    }

    var obj = null;
    if (data instanceof AbstractClass && !data.id) {
        obj = data;
        data = obj.toObject();
    }

    this.schema.adapter.create(modelName, data, function (err, id) {
        obj = obj || new this(data);
        if (id) {
            defineReadonlyProp(obj, 'id', id);
            this.cache[id] = obj;
        }
        if (callback) {
            callback(err, obj);
        }
    }.bind(this));

};

AbstractClass.exists = function exists(id, cb) {
    this.schema.adapter.exists(this.modelName, id, cb);
};

AbstractClass.find = function find(id, cb) {
    this.schema.adapter.find(this.modelName, id, function (err, data) {
        var obj = null;
        if (data) {
            if (this.cache[data.id]) {
                obj = this.cache[data.id];
                this.call(obj, data);
            } else {
                obj = new this(data);
                this.cache[data.id] = obj;
            }
        }
        cb(err, obj);
    }.bind(this));
};

AbstractClass.all = function all(filter, cb) {
    if (arguments.length === 1) {
        cb = filter;
        filter = null;
    }
    var constr = this;
    this.schema.adapter.all(this.modelName, filter, function (err, data) {
        var collection = null;
        if (data && data.map) {
            collection = data.map(function (d) {
                var obj = null;
                if (constr.cache[d.id]) {
                    obj = constr.cache[d.id];
                    constr.call(obj, d);
                } else {
                    obj = new constr(d);
                    constr.cache[d.id] = obj;
                }
                return obj;
            });
            cb(err, collection);
        }
    });
};

AbstractClass.destroyAll = function destroyAll(cb) {
    this.schema.adapter.destroyAll(this.modelName, function (err) {
        if (!err) {
            Object.keys(this.cache).forEach(function (id) {
                delete this.cache[id];
            }.bind(this));
        }
        cb(err);
    }.bind(this));
};

AbstractClass.count = function (cb) {
    this.schema.adapter.count(this.modelName, cb);
};

AbstractClass.toString = function () {
    return '[Model ' + this.modelName + ']';
}

/**
 * @param options {validate: true, throws: false} [optional]
 * @param callback(err, obj)
 */
AbstractClass.prototype.save = function (options, callback) {
    if (typeof options == 'function') {
        callback = options;
        options = {};
    }
    if (!('validate' in options)) {
        options.validate = true;
    }
    if (!('throws' in options)) {
        options.throws = false;
    }
    if (options.validate && !this.isValid()) {
        var err = new Error('Validation error');
        if (options.throws) {
            throw err;
        }
        return callback && callback(err);
    }
    var modelName = this.constructor.modelName;
    var data = this.toObject();
    if (this.id) {
        this._adapter().save(modelName, data, function (err) {
            if (err) {
                console.log(err);
            } else {
                this.constructor.call(this, data);
            }
            if (callback) {
                callback(err, this);
            }
        }.bind(this));
    } else {
        this.constructor.create(this, callback);
    }
};

AbstractClass.prototype._adapter = function () {
    return this.constructor.schema.adapter;
};

AbstractClass.prototype.propertyChanged = function (name) {
    return this[name + '_was'] !== this['_' + name];
};

AbstractClass.prototype.toObject = function () {
    // blind faith: we only enumerate properties
    var data = {};
    Object.keys(this).forEach(function (property) {
        data[property] = this[property];
    }.bind(this));
    return data;
};

AbstractClass.prototype.destroy = function (cb) {
    this._adapter().destroy(this.constructor.modelName, this.id, function (err) {
        delete this.constructor.cache[this.id];
        cb && cb(err);
    }.bind(this));
};

AbstractClass.prototype.updateAttribute = function (name, value, cb) {
    data = {};
    data[name] = value;
    this.updateAttributes(data, cb);
};

AbstractClass.prototype.updateAttributes = function updateAttributes(data, cb) {
    var model = this.constructor.modelName;
    this._adapter().updateAttributes(model, this.id, data, function (err) {
        if (!err) {
            Object.keys(data).forEach(function (key) {
                this[key] = data[key];
                Object.defineProperty(this, key + '_was', {
                    writable:     false,
                    configurable: true,
                    enumerable:   false,
                    value:        data[key]
                });
            }.bind(this));
        }
        cb(err);
    }.bind(this));
};

/**
 * Checks is property changed based on current property and initial value
 * @param {attr} String - property name
 * @return Boolean
 */
AbstractClass.prototype.propertyChanged = function (attr) {
    return this['_' + attr] !== this[attr + '_was'];
};


AbstractClass.prototype.reload = function (cb) {
    this.constructor.find(this.id, cb);
};

// relations
AbstractClass.hasMany = function (anotherClass, params) {
    var methodName = params.as; // or pluralize(anotherClass.modelName)
    var fk = params.foreignKey;
    // console.log(this.modelName, 'has many', anotherClass.modelName, 'as', params.as, 'queried by', params.foreignKey);
    // each instance of this class should have method named
    // pluralize(anotherClass.modelName)
    // which is actually just anotherClass.all({thisModelNameId: this.id}, cb);
    this.prototype[methodName] = function (cond, cb) {
        var actualCond;
        if (arguments.length === 1) {
            actualCond = {};
            cb = cond;
        } else if (arguments.length === 2) {
            actualCond = cond;
        } else {
            throw new Error(anotherClass.modelName + ' only can be called with one or two arguments');
        }
        actualCond[fk] = this.id;
        return anotherClass.all(actualCond, cb);
    };

    // obviously, anotherClass should have attribute called `fk`
    anotherClass.schema.defineForeignKey(anotherClass.modelName, fk);

    // and it should have create/build methods with binded thisModelNameId param
    this.prototype['build' + anotherClass.modelName] = function (data) {
        data = data || {};
        data[fk] = this.id; // trick! this.fk defined at runtime (when got it)
        // but we haven't instance here to schedule this action
        return new anotherClass(data);
    };

    this.prototype['create' + anotherClass.modelName] = function (data, cb) {
        if (typeof data === 'function') {
            cb = data;
            data = {};
        }
        this['build' + anotherClass.modelName](data).save(cb);
    };

};

AbstractClass.belongsTo = function (anotherClass, params) {
    var methodName = params.as;
    var fk = params.foreignKey;
    // anotherClass.schema.defineForeignKey(anotherClass.modelName, fk);
    this.prototype[methodName] = function (p, cb) {
        if (p instanceof AbstractClass) { // acts as setter
            this[fk] = p.id;
            this.cachedRelations[methodName] = p;
        } else if (typeof p === 'function') { // acts as async getter
            this.find(this[fk], function (err, obj) {
                if (err) return p(err);
                this.cachedRelations[methodName] = obj;
            }.bind(this));
        } else if (!p) { // acts as sync getter
            return this.cachedRelations[methodName] || this[fk];
        }
    }
};

// helper methods
//
function isdef(s) {
    var undef;
    return s !== undef;
}

function merge(base, update) {
    Object.keys(update).forEach(function (key) {
        base[key] = update[key];
    });
    return base;
}

function hiddenProperty(where, property, value) {
    Object.defineProperty(where, property, {
        writable: false,
        enumerable: false,
        configurable: false,
        value: value
    });
}

function defineReadonlyProp(obj, key, value) {
    Object.defineProperty(obj, key, {
        writable: false,
        enumerable: true,
        configurable: true,
        value: value
    });
}

