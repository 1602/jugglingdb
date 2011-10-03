exports.Schema = Schema;
// exports.AbstractClass = AbstractClass;

var slice = Array.prototype.slice;

/**
 * Shema - classes factory
 * @param name - type of schema adapter (mysql, mongoose, sequelize, redis)
 * @param settings - any database-specific settings which we need to
 * establish connection (of course it depends on specific adapter)
 */
function Schema(name, settings) {
    // just save everything we get
    this.name = name;
    this.settings = settings;

    // create blank models pool
    this.models = {};

    // and initialize schema using adapter
    // this is only one initialization entry point of adapter
    // this module should define `adapter` member of `this` (schema)
    require('./lib/' + name).initialize(this, function () {
        this.connected = true;
        this.emit('connected');
    }.bind(this));

    // we have an adaper now?
    if (!this.adapter) {
        throw new Error('Adapter is not defined correctly: it should create `adapter` member of schema');
    }
};

require('util').inherits(Schema, process.EventEmitter);

function Text() {
}
Schema.Text = Text;

Schema.prototype.automigrate = function (cb) {
    if (this.adapter.automigrate) {
        this.adapter.automigrate(cb);
    } else {
        cb && cb();
    }
};

/**
 * Define class
 * @param className
 * @param properties - hash of class properties in format
 *                     {property: Type, property2: Type2, ...}
 *                     or
 *                     {property: {type: Type}, property2: {type: Type2}, ...}
 * @param settings - other configuration of class
 */
Schema.prototype.define = function defineClass(className, properties, settings) {
    var schema = this;
    var args = slice.call(arguments);

    if (!className) throw new Error('Class name required');
    if (args.length == 1) properties = {}, args.push(properties);
    if (args.length == 2) settings   = {}, args.push(settings);

    standartize(properties, settings);

    // every class can receive hash of data as optional param
    var newClass = function (data) {
        AbstractClass.apply(this, args.concat([data]));
    };

    hiddenProperty(newClass, 'schema', schema);
    hiddenProperty(newClass, 'modelName', className);
    hiddenProperty(newClass, 'cache', {});

    // setup inheritance
    newClass.__proto__ = AbstractClass;
    require('util').inherits(newClass, AbstractClass);

    // store class in model pool
    this.models[className] = newClass;

    // pass controll to adapter
    this.adapter.define({
        model:      newClass,
        properties: properties,
        settings:   settings
    });

    return newClass;

    function standartize(properties, settings) {
        Object.keys(properties).forEach(function (key) {
            var v = properties[key];
            if (typeof v === 'function') {
                properties[key] = { type: v };
            }
        });
        // TODO: add timestamps fields
        // when present in settings: {timestamps: true}
        // or {timestamps: {created: 'created_at', updated: false}}
        // by default property names: createdAt, updatedAt
    }

};

/**
 * Abstract class constructor
 */
function AbstractClass(name, properties, settings, data) {
    var self = this;
    data = data || {};

    if (data.id) {
        Object.defineProperty(this, 'id', {
            writable: false,
            enumerable: true,
            configurable: true,
            value: data.id
        });
    }

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
            obj.id = id;
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
 * @param callback(err, obj)
 */
AbstractClass.prototype.save = function (callback) {
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

// helper methods
//
function isdef(s) {
    var undef;
    return s !== undef;
}

function hiddenProperty(where, property, value) {
    Object.defineProperty(where, property, {
        writable: false,
        enumerable: false,
        configurable: false,
        value: value
    });
}

