/**
 * Module dependencies
 */
var AbstractClass = require('./model.js');
var List = require('./list.js');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var path = require('path');
var fs = require('fs');

var existsSync = fs.existsSync || path.existsSync;

/**
 * Export public API
 */
exports.Schema = Schema;
// exports.AbstractClass = AbstractClass;

/**
 * Helpers
 */
var slice = Array.prototype.slice;

Schema.Text = function Text(s) { return s; };
Schema.JSON = function JSON() {};

Schema.types = {};
Schema.registerType = function (type) {
    this.types[type.name] = type;
};

Schema.registerType(Schema.Text);
Schema.registerType(Schema.JSON);


/**
 * Schema - adapter-specific classes factory.
 *
 * All classes in single schema shares same adapter type and
 * one database connection
 *
 * @param name - type of schema adapter (mysql, mongoose, sequelize, redis)
 * @param settings - any database-specific settings which we need to
 * establish connection (of course it depends on specific adapter)
 *
 * - host
 * - port
 * - username
 * - password
 * - database
 * - debug {Boolean} = false
 *
 * @example Schema creation, waiting for connection callback
 * ```
 * var schema = new Schema('mysql', { database: 'myapp_test' });
 * schema.define(...);
 * schema.on('connected', function () {
 *     // work with database
 * });
 * ```
 */
function Schema(name, settings) {
    var schema = this;
    // just save everything we get
    this.name = name;
    this.settings = settings || {};

    // Disconnected by default
    this.connected = false;
    this.connecting = false;

    // create blank models pool
    this.models = {};
    this.definitions = {};

    if (this.settings.log) {
        this.on('log', function(str, duration) {
            console.log(str);
        });
    }

    // and initialize schema using adapter
    // this is only one initialization entry point of adapter
    // this module should define `adapter` member of `this` (schema)
    var adapter;
    if (typeof name === 'object') {
        adapter = name;
        this.name = adapter.name;
    } else if (name.match(/^\//)) {
        // try absolute path
        adapter = require(name);
    } else if (existsSync(__dirname + '/adapters/' + name + '.js')) {
        // try built-in adapter
        adapter = require('./adapters/' + name);
    } else {
        // try foreign adapter
        try {
            adapter = require('jugglingdb-' + name);
        } catch (e) {
            return console.log('\nWARNING: JugglingDB adapter "' + name + '" is not installed,\nso your models would not work, to fix run:\n\n    npm install jugglingdb-' + name, '\n');
        }
    }

    this.connecting = true;
    adapter.initialize(this, function () {

        this.adapter.log = function (query, start) {
            schema.log(query, start);
        };

        this.adapter.logger = function (query) {
            var t1 = Date.now();
            var log = this.log;
            return function (q) {
                log(q || query, t1);
            };
        };

        this.connecting = false;
        this.connected = true;
        this.emit('connected');

    }.bind(this));

    // we have an adaper now?
    if (!this.adapter) {
        this.emit('disconnected');
        throw new Error('Adapter "' + name + '" is not defined correctly: it should define `adapter` member of schema synchronously');
    }


    schema.connect = function(cb) {
        var schema = this;
        schema.connecting = true;
        if (schema.adapter.connect) {
            schema.adapter.connect(function(err) {
                if (!err) {
                    schema.connected = true;
                    schema.connecting = false;
                    schema.emit('connected');
                }
                if (cb) {
                    cb(err);
                }
            });
        } else {
            if (cb) {
                process.nextTick(cb);
            }
        }
    };
}

util.inherits(Schema, EventEmitter);

/**
 * Define class
 *
 * @param {String} className
 * @param {Object} properties - hash of class properties in format
 *   `{property: Type, property2: Type2, ...}`
 *   or
 *   `{property: {type: Type}, property2: {type: Type2}, ...}`
 * @param {Object} settings - other configuration of class
 * @return newly created class
 *
 * @example simple case
 * ```
 * var User = schema.define('User', {
 *     email: String,
 *     password: String,
 *     birthDate: Date,
 *     activated: Boolean
 * });
 * ```
 * @example more advanced case
 * ```
 * var User = schema.define('User', {
 *     email: { type: String, limit: 150, index: true },
 *     password: { type: String, limit: 50 },
 *     birthDate: Date,
 *     registrationDate: {type: Date, default: function () { return new Date }},
 *     activated: { type: Boolean, default: false }
 * });
 * ```
 */
Schema.prototype.define = function defineClass(className, properties, settings) {
    var schema = this;
    var args = slice.call(arguments);

    if (!className) {
        throw new Error('Class name required');
    }
    if (args.length == 1) {
        properties = {};
        args.push(properties);
    }
    if (args.length == 2) {
        settings = {};
        args.push(settings);
    }

    settings = settings || {};

    if ('function' === typeof properties) {
        var props = {};
        properties({
            property: function(name, type, settings) {
                settings = settings || {};
                settings.type = type;
                props[name] = settings;
            },
            set: function(key, val) {
                settings[key] = val;
            }
        });
        properties = props;
    }

    properties = properties || {};

    // every class can receive hash of data as optional param
    var NewClass = function ModelConstructor(data, schema) {
        if (!(this instanceof ModelConstructor)) {
            return new ModelConstructor(data);
        }
        AbstractClass.call(this, data);
        hiddenProperty(this, 'schema', schema || this.constructor.schema);
    };

    hiddenProperty(NewClass, 'schema', schema);
    hiddenProperty(NewClass, 'settings', settings);
    hiddenProperty(NewClass, 'properties', properties);
    hiddenProperty(NewClass, 'modelName', className);
    hiddenProperty(NewClass, 'tableName', settings.table || className);
    hiddenProperty(NewClass, 'relations', {});

    // inherit AbstractClass methods
    for (var i in AbstractClass) {
        NewClass[i] = AbstractClass[i];
    }
    for (var j in AbstractClass.prototype) {
        NewClass.prototype[j] = AbstractClass.prototype[j];
    }

    NewClass.getter = {};
    NewClass.setter = {};

    standartize(properties, settings);

    // store class in model pool
    this.models[className] = NewClass;
    this.definitions[className] = {
        properties: properties,
        settings: settings
    };

    // pass control to adapter
    this.adapter.define({
        model:      NewClass,
        properties: properties,
        settings:   settings
    });

    NewClass.prototype.__defineGetter__('id', function () {
        return this.__data.id;
    });

    properties.id = properties.id || { type: schema.settings.slave ? String : Number };

    NewClass.forEachProperty = function (cb) {
        Object.keys(properties).forEach(cb);
    };

    NewClass.registerProperty = function (attr) {
        var DataType = properties[attr].type;
        if (DataType instanceof Array) {
            DataType = List;
        } else if (DataType.name === 'Date') {
            var OrigDate = Date;
            DataType = function Date(arg) {
                return new OrigDate(arg);
            };
        } else if (DataType.name === 'JSON' || DataType === JSON) {
            DataType = function JSON(s) {
                return s;
            };
        } else if (DataType.name === 'Text' || DataType === Schema.Text) {
            DataType = function Text(s) {
                return s;
            };
        }

        Object.defineProperty(NewClass.prototype, attr, {
            get: function () {
                if (NewClass.getter[attr]) {
                    return NewClass.getter[attr].call(this);
                } else {
                    return this.__data[attr];
                }
            },
            set: function (value) {
                if (NewClass.setter[attr]) {
                    NewClass.setter[attr].call(this, value);
                } else {
                    if (value === null || value === undefined || typeof DataType === 'object') {
                        this.__data[attr] = value;
                    } else if (DataType === Boolean) {
                        this.__data[attr] = value === 'false' ? false : !!value;
                    } else {
                        this.__data[attr] = DataType(value);
                    }
                }
            },
            configurable: true,
            enumerable: true
        });

        NewClass.prototype.__defineGetter__(attr + '_was', function () {
            return this.__dataWas[attr];
        });

        Object.defineProperty(NewClass.prototype, '_' + attr, {
            get: function () {
                return this.__data[attr];
            },
            set: function (value) {
                this.__data[attr] = value;
            },
            configurable: true,
            enumerable: false
        });
    };

    NewClass.forEachProperty(NewClass.registerProperty);

    this.emit('define', NewClass, className, properties, settings);

    return NewClass;

};

    function standartize(properties, settings) {
        Object.keys(properties).forEach(function (key) {
            var v = properties[key];
            if (
                typeof v === 'function' ||
                typeof v === 'object' && v && v.constructor.name === 'Array'
            ) {
                properties[key] = { type: v };
            }
        });
        // TODO: add timestamps fields
        // when present in settings: {timestamps: true}
        // or {timestamps: {created: 'created_at', updated: false}}
        // by default property names: createdAt, updatedAt
    }

/**
 * Define single property named `prop` on `model`
 *
 * @param {String} model - name of model
 * @param {String} prop - name of propery
 * @param {Object} params - property settings
 */
Schema.prototype.defineProperty = function (model, prop, params) {
    this.definitions[model].properties[prop] = params;
    this.models[model].registerProperty(prop);
    if (this.adapter.defineProperty) {
        this.adapter.defineProperty(model, prop, params);
    }
};

/**
 * Extend existing model with bunch of properties
 *
 * @param {String} model - name of model
 * @param {Object} props - hash of properties
 *
 * Example:
 *
 *     // Instead of doing this:
 *
 *     // amend the content model with competition attributes
 *     db.defineProperty('Content', 'competitionType', { type: String });
 *     db.defineProperty('Content', 'expiryDate', { type: Date, index: true });
 *     db.defineProperty('Content', 'isExpired', { type: Boolean, index: true });
 *
 *     // schema.extend allows to
 *     // extend the content model with competition attributes
 *     db.extendModel('Content', {
 *       competitionType: String,
 *       expiryDate: { type: Date, index: true },
 *       isExpired: { type: Boolean, index: true }
 *     });
 */
Schema.prototype.extendModel = function (model, props) {
    var t = this;
    standartize(props, {});
    Object.keys(props).forEach(function (propName) {
        var definition = props[propName];
        t.defineProperty(model, propName, definition);
    });
};

/**
 * Drop each model table and re-create.
 * This method make sense only for sql adapters.
 *
 * @warning All data will be lost! Use autoupdate if you need your data.
 */
Schema.prototype.automigrate = function (cb) {
    this.freeze();
    if (this.adapter.automigrate) {
        this.adapter.automigrate(cb);
    } else if (cb) {
        cb();
    }
};

/**
 * Update existing database tables.
 * This method make sense only for sql adapters.
 */
Schema.prototype.autoupdate = function (cb) {
    this.freeze();
    if (this.adapter.autoupdate) {
        this.adapter.autoupdate(cb);
    } else if (cb) {
        cb();
    }
};

/**
 * Check whether migrations needed
 * This method make sense only for sql adapters.
 */
Schema.prototype.isActual = function (cb) {
    this.freeze();
    if (this.adapter.isActual) {
        this.adapter.isActual(cb);
    } else if (cb) {
        cb(null, true);
    }
};

/**
 * Log benchmarked message. Do not redefine this method, if you need to grab
 * chema logs, use `schema.on('log', ...)` emitter event
 *
 * @private used by adapters
 */
Schema.prototype.log = function (sql, t) {
    this.emit('log', sql, t);
};

/**
 * Freeze schema. Behavior depends on adapter
 */
Schema.prototype.freeze = function freeze() {
    if (this.adapter.freezeSchema) {
        this.adapter.freezeSchema();
    }
};

/**
 * Backward compatibility. Use model.tableName prop instead.
 * Return table name for specified `modelName`
 * @param {String} modelName
 */
Schema.prototype.tableName = function (modelName) {
    return this.models[modelName].model.tableName;
};

/**
 * Define foreign key
 * @param {String} className
 * @param {String} key - name of key field
 */
Schema.prototype.defineForeignKey = function defineForeignKey(className, key, foreignClassName) {
    // quit if key already defined
    if (this.definitions[className].properties[key]) return;

    if (this.adapter.defineForeignKey) {
        var cb = function (err, keyType) {
            if (err) throw err;
            this.definitions[className].properties[key] = {type: keyType};
        }.bind(this);
        switch (this.adapter.defineForeignKey.length) {
            case 4:
                this.adapter.defineForeignKey(className, key, foreignClassName, cb);
            break;
            default:
            case 3:
                this.adapter.defineForeignKey(className, key, cb);
            break;
        }
    } else {
        this.definitions[className].properties[key] = {type: Number};
    }
    this.models[className].registerProperty(key);
};

/**
 * Close database connection
 */
Schema.prototype.disconnect = function disconnect(cb) {
    if (typeof this.adapter.disconnect === 'function') {
        this.connected = false;
        this.adapter.disconnect(cb);
        this.emit('disconnected');
    } else if (cb) {
        cb();
    }
};

Schema.prototype.copyModel = function copyModel(Master) {
    var schema = this;
    var className = Master.modelName;
    var md = Master.schema.definitions[className];
    var Slave = function SlaveModel() {
        Master.apply(this, [].slice.call(arguments));
        this.schema = schema;
    };

    util.inherits(Slave, Master);

    Slave.__proto__ = Master;

    hiddenProperty(Slave, 'schema', schema);
    hiddenProperty(Slave, 'modelName', className);
    hiddenProperty(Slave, 'tableName', Master.tableName);
    hiddenProperty(Slave, 'relations', Master.relations);

    if (!(className in schema.models)) {

        // store class in model pool
        schema.models[className] = Slave;
        schema.definitions[className] = {
            properties: md.properties,
            settings: md.settings
        };

        if (!schema.isTransaction) {
            schema.adapter.define({
                model:      Slave,
                properties: md.properties,
                settings:   md.settings
            });
        }

    }

    return Slave;
};

Schema.prototype.transaction = function() {
    var schema = this;
    var transaction = new EventEmitter();
    transaction.isTransaction = true;
    transaction.origin = schema;
    transaction.name = schema.name;
    transaction.settings = schema.settings;
    transaction.connected = false;
    transaction.connecting = false;
    transaction.adapter = schema.adapter.transaction();

    // create blank models pool
    transaction.models = {};
    transaction.definitions = {};

    for (var i in schema.models) {
        schema.copyModel.call(transaction, schema.models[i]);
    }

    transaction.connect = schema.connect;

    transaction.exec = function(cb) {
        transaction.adapter.exec(cb);
    };

    return transaction;
};

/**
 * Define hidden property
 */
function hiddenProperty(where, property, value) {
    Object.defineProperty(where, property, {
        writable: false,
        enumerable: false,
        configurable: false,
        value: value
    });
}

/**
 * Define readonly property on object
 *
 * @param {Object} obj
 * @param {String} key
 * @param {Mixed} value
 */
function defineReadonlyProp(obj, key, value) {
    Object.defineProperty(obj, key, {
        writable: false,
        enumerable: true,
        configurable: true,
        value: value
    });
}

