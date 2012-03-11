/**
 * Module dependencies
 */
var AbstractClass = require('./abstract-class').AbstractClass;
var util = require('util');
var path = require('path');

/**
 * Export public API
 */
exports.Schema = Schema;
// exports.AbstractClass = AbstractClass;

/**
 * Helpers
 */
var slice = Array.prototype.slice;

/**
 * Shema - classes factory
 * @param name - type of schema adapter (mysql, mongoose, sequelize, redis)
 * @param settings - any database-specific settings which we need to
 * establish connection (of course it depends on specific adapter)
 */
function Schema(name, settings) {
    var schema = this;
    // just save everything we get
    this.name = name;
    this.settings = settings;

    // create blank models pool
    this.models = {};
    this.definitions = {};

    // and initialize schema using adapter
    // this is only one initialization entry point of adapter
    // this module should define `adapter` member of `this` (schema)
    var adapter;
    if (path.existsSync(__dirname + '/adapters/' + name + '.js')) {
        adapter = require('./adapters/' + name);
    } else {
        try {
            adapter = require(name);
        } catch (e) {
            throw new Error('Adapter ' + name + ' is not defined, try\n  npm install ' + name);
        }
    }

    adapter.initialize(this, function () {

        // we have an adaper now?
        if (!this.adapter) {
            throw new Error('Adapter is not defined correctly: it should create `adapter` member of schema');
        }

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

        this.connected = true;
        this.emit('connected');

    }.bind(this));
};

util.inherits(Schema, require('events').EventEmitter);

function Text() {
}
Schema.Text = Text;

Schema.prototype.defineProperty = function (model, prop, params) {
    this.definitions[model].properties[prop] = params;
    if (this.adapter.defineProperty) {
        this.adapter.defineProperty(model, prop, params);
    }
};

Schema.prototype.automigrate = function (cb) {
    this.freeze();
    if (this.adapter.automigrate) {
        this.adapter.automigrate(cb);
    } else if (cb) {
        cb();
    }
};

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
 */
Schema.prototype.isActual = function (cb) {
    this.freeze();
    if (this.adapter.isActual) {
        this.adapter.isActual(cb);
    } else if (cb) {
        cb(null, true);
    }
};

Schema.prototype.log = function (sql, t) {
    this.emit('log', sql, t);
};

Schema.prototype.freeze = function freeze() {
    if (this.adapter.freezeSchema) {
        this.adapter.freezeSchema();
    }
}

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
    var newClass = function ModelConstructor(data) {
        if (!(this instanceof ModelConstructor)) {
            return new ModelConstructor(data);
        }
        AbstractClass.call(this, data);
    };

    hiddenProperty(newClass, 'schema', schema);
    hiddenProperty(newClass, 'modelName', className);
    hiddenProperty(newClass, 'cache', {});

    // setup inheritance
    newClass.__proto__ = AbstractClass;
    util.inherits(newClass, AbstractClass);

    // store class in model pool
    this.models[className] = newClass;
    this.definitions[className] = {
        properties: properties,
        settings: settings
    };

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

Schema.prototype.tableName = function (modelName) {
    return this.definitions[modelName].settings.table = this.definitions[modelName].settings.table || modelName
};

Schema.prototype.defineForeignKey = function defineForeignKey(className, key) {
    // return if already defined
    if (this.definitions[className].properties[key]) return;

    if (this.adapter.defineForeignKey) {
        this.adapter.defineForeignKey(className, key, function (err, keyType) {
            if (err) throw err;
            this.definitions[className].properties[key] = {type: keyType};
        }.bind(this));
    } else {
        this.definitions[className].properties[key] = {type: Number};
    }
};

Schema.prototype.disconnect = function disconnect() {
    if (typeof this.adapter.disconnect === 'function') {
        this.adapter.disconnect();
    }
};


function hiddenProperty(where, property, value) {
    Object.defineProperty(where, property, {
        writable: false,
        enumerable: false,
        configurable: false,
        value: value
    });
}

