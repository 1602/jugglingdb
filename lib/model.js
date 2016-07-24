/**
 * Module exports class Model
 */
module.exports = AbstractClass;

/**
 * Module dependencies
 */
var setImmediate = global.setImmediate || process.nextTick;
var util = require('util');
var validations = require('./validations.js');
var ValidationError = validations.ValidationError;
var List = require('./list.js');
var when = require('when');
require('./hooks.js');
require('./relations.js');
require('./include.js');

var BASE_TYPES = ['String', 'Boolean', 'Number', 'Date', 'Text'];

/**
 * Model class - base class for all persist objects
 * provides **common API** to access any database adapter.
 * This class describes only abstract behavior layer, refer to `lib/adapters/*.js`
 * to learn more about specific adapter implementations
 *
 * `AbstractClass` mixes `Validatable` and `Hookable` classes methods
 *
 * @constructor
 * @param {Object} data - initial object data
 */
function AbstractClass(data) {
    this._initProperties(data, true);
}

var promisedClassMethods = [
    'create', 'all', 'destroyAll', 'upsert', 'updateOrCreate', 'findOrCreate', 'find', 'update',
    'findOne', 'exists', 'count'
];

var promisedInstanceMethods = [
    'save', 'updateAttribute', 'updateAttributes', 'destroy', 'reload'
];

AbstractClass.prototype._initProperties = function (data, applySetters) {
    var self = this;
    var ctor = this.constructor;
    var ds = ctor.schema.definitions[ctor.modelName];
    var properties = ds.properties;
    data = data || {};

    Object.defineProperty(this, '__cachedRelations', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    Object.defineProperty(this, '__data', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    Object.defineProperty(this, '__dataWas', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    if (data.__cachedRelations) {
        this.__cachedRelations = data.__cachedRelations;
    }

    for (var i in data) {
        if (i in properties) {
            this.__data[i] = this.__dataWas[i] = data[i];
        } else if (i in ctor.relations) {
            this.__data[ctor.relations[i].keyFrom] = this.__dataWas[i] = data[i][ctor.relations[i].keyTo];
            this.__cachedRelations[i] = data[i];
        }
    }

    if (applySetters === true) {
        Object.keys(data).forEach(function (attr) {
            self[attr] = data[attr];
        });
    }

    ctor.forEachProperty(function (attr) {

        if ('undefined' === typeof self.__data[attr]) {
            self.__data[attr] = self.__dataWas[attr] = getDefault(attr);
        } else {
            self.__dataWas[attr] = self.__data[attr];
        }

    });

    ctor.forEachProperty(function (attr) {

        var type = properties[attr].type;

        if (BASE_TYPES.indexOf(type.name) === -1) {
            if (typeof self.__data[attr] !== 'object' && self.__data[attr]) {
                try {
                    self.__data[attr] = JSON.parse(self.__data[attr] + '');
                } catch (e) {
                    self.__data[attr] = String(self.__data[attr]);
                }
            }
            if (type.name === 'Array' || typeof type === 'object' && type.constructor.name === 'Array') {
                self.__data[attr] = new List(self.__data[attr], type, self);
            }
        }

    });

    function getDefault(attr) {
        var def = properties[attr]['default'];
        if (isdef(def)) {
            if (typeof def === 'function') {
                return def();
            } else {
                return def;
            }
        } else {
            return undefined;
        }
    }

    this.trigger('initialize');
};

/**
 * @param {String} prop - property name
 * @param {Object} params - various property configuration
 */
AbstractClass.defineProperty = function (prop, params) {
    this.schema.defineProperty(this.modelName, prop, params);
};

AbstractClass.whatTypeName = function (propName) {
    var prop = this.schema.definitions[this.modelName].properties[propName];
    if (!prop || !prop.type) {
        return null;
        // throw new Error('Undefined type for ' + this.modelName + ':' + propName);
    }
    return prop.type.name;
};

/**
 * Updates the respective record
 *
 * @param {Object} params - { where:{uid:'10'}, update:{ Name:'New name' } }
 * @param callback(err, obj)
 */
AbstractClass.update = function (params, cb) {
    var Model = this;

    this.schema.callAdapter('update', this.modelName, params, function(err, obj) {
        cb(err, Model._fromDB(obj));
    });

};

/**
 * Unpacks data from storage adapter.
 *
 * If the schema defines a custom field name, it is transformed here.
 *
 * @param {Object} data
 * @return {Object}
 */
AbstractClass._fromDB = function (data) {
    if (!data) return;
    var definition = this.schema.definitions[this.modelName].properties;
    var propNames = Object.keys(data);
    Object.keys(definition).forEach(function (defPropName) {
      var customName = definition[defPropName].name;
      if (customName && propNames.indexOf(customName) !== -1) {
        data[defPropName] = data[customName];
        delete data[customName];
      }
    });
    return data;
};

AbstractClass.prototype.whatTypeName = function (propName) {
    return this.constructor.whatTypeName(propName);
};

/**
 * Create new instance of Model class, saved in database
 *
 * @param data [optional]
 * @param callback(err, obj)
 * callback called with arguments:
 *
 *   - err (null or Error)
 *   - instance (null or Model)
 */
AbstractClass.create = function (data, callback) {

    var Model = this;
    var modelName = Model.modelName;

    if (typeof data === 'function') {
        callback = data;
        data = {};
    }

    if (typeof callback !== 'function') {
        callback = function () {};
    }

    if (!data) {
        data = {};
    }

    // Passed via data from save
    var options = data.options || { validate: true };

    if (data.data instanceof Model) {
        data = data.data;
        data.__dataWas = data.__data;
    }

    if (data instanceof Array) {
        var instances = Array(data.length);
        var errors = Array(data.length);
        var gotError = false;
        var wait = data.length;
        if (wait === 0) callback(null, []);

        for (var i = 0; i < data.length; i += 1) {
            createModel(data[i], i);
        }

        return instances;
    }

    function createModel(d, i) {
        Model.create(d, function(err, inst) {
            if (err) {
                errors[i] = err;
                gotError = true;
            }
            instances[i] = inst;
            modelCreated();
        });
    }

    function modelCreated() {
        if (--wait === 0) {
            callback(gotError ? errors : null, instances);
        }
    }

    var obj;
    // if we come from save
    if (data instanceof Model && !data.id) {
        obj = data;
    } else {
        obj = new Model(data);
    }
    data = obj.toObject(true);

    if (!options.validate) {
        create();
    }
    else {
        // validation required
        obj.isValid(function(err, valid) {
            if (valid) {
                create();
            } else {
                err = err || new ValidationError(obj);
                callback(err, obj);
            }
        }, data);
    }

    function create() {
        obj.trigger('create', function(createDone) {
            obj.trigger('save', function(saveDone) {

                this.schema.callAdapter('create', modelName, obj.toObject(true), function (err, id, rev) {
                    if (id) {
                        obj.__data.id = id;
                        obj.__dataWas.id = id;
                        defineReadonlyProp(obj, 'id', id);
                    }
                    if (rev) {
                        rev = Model._fromDB(rev);
                        obj._rev = rev;
                    }
                    // if error occurs, we should not return a valid obj
                    if (err) {
                        return callback(err, obj);
                    }
                    saveDone.call(obj, function () {
                        createDone.call(obj, function () {
                            callback(err, obj);
                        });
                    });
                });
            }, obj, callback);
        }, obj, callback);
    }

    return obj;
};

function connection(schema) {
    if (schema.connected) {
        return when.Promise.resolve();
    } else {
        if (schema.connecting) {
            return new when.Promise(function(resolve) {
                schema.once('connected', function () {
                    resolve();
                });
            });
        } else {
            return schema.connect();
        }
    }
}

/**
 * Update or insert
 */
AbstractClass.upsert = AbstractClass.updateOrCreate = function upsert(data, callback) {

    var Model = this;
    if (!data.id) return this.create(data, callback);
    if (this.schema.adapter.updateOrCreate) {
        var inst = new Model(data);
        this.schema.callAdapter('updateOrCreate', Model.modelName, stripUndefined(inst.toObject(true)), function (err, data) {
            var obj;
            if (data) {
                return inst.reload(callback);
            } else {
                obj = null;
            }
            callback(err, obj);
        });
    } else {
        this.find(data.id, function (err, inst) {
            if (err) return callback(err);
            if (inst) {
                inst.updateAttributes(data, callback);
            } else {
                var obj = new Model(data);
                obj.save(data, callback);
            }
        });
    }

    function stripUndefined(data) {
        return Object.keys(data)
            .filter(function(key) {
                return typeof data[key] !== 'undefined';
            })
            .reduce(function(result, key) {
                result[key] = data[key];
                return result;
            }, {});
    }
};

/**
 * Find one record, same as `all`, limited by 1 and return object, not collection,
 * if not found, create using data provided as second argument
 *
 * @param {Object} query - search conditions: {where: {test: 'me'}}.
 * @param {Object} data - object to create.
 * @param {Function} cb - callback called with (err, instance)
 */
AbstractClass.findOrCreate = function findOrCreate(query, data, callback) {
    if (typeof query === 'undefined') {
        query = {where: {}};
    }
    if (typeof data === 'function' || typeof data === 'undefined') {
        callback = data;
        data = query && query.where;
    }
    if (typeof callback === 'undefined') {
        callback = function () {};
    }

    var t = this;
    this.findOne(query, function (err, record) {
        if (err) return callback(err);
        if (record) return callback(null, record);
        t.create(data, callback);
    });
};

/**
 * Check whether object exists in database
 *
 * @param {id} id - identifier of object (primary key value)
 * @param {Function} cb - callback called with (err, exists: Bool)
 */
AbstractClass.exists = function exists(id, cb) {
    if (id) {
        this.schema.callAdapter('exists', this.modelName, id, cb);
    } else {
        cb(new Error('Model::exists requires positive id argument'));
    }
};

/**
 * Find object by id
 *
 * @param {id} id - primary key value
 * @param {Function} cb - callback called with (err, instance)
 */
AbstractClass.find = function find(id, cb) {
    var Model = this;

    this.schema.callAdapter('find', Model.modelName, id, function (err, data) {
        var obj = null;
        if (data) {
            data = Model._fromDB(data);
            if (!data.id) {
                data.id = id;
            }
            obj = new Model();
            obj._initProperties(data, false);
        }
        cb(err, obj);
    });
};

/**
 * Find all instances of Model, matched by query
 * make sure you have marked as `index: true` fields for filter or sort
 *
 * @param {Object} params (optional)
 *
 * - where: Object `{ key: val, key2: {gt: 'val2'}}`
 * - attributes: Array ['id, 'name'] or String 'id'
 * - include: String, Object or Array. See AbstractClass.include documentation.
 * - order: String
 * - limit: Number
 * - skip: Number
 *
 * @param {Function} callback (required) called with arguments:
 *
 * - err (null or Error)
 * - Array of instances
 */
AbstractClass.all = function all(params, cb) {

    if (arguments.length === 1) {
        cb = params;
        params = null;
    }
    if (params) {
        if ('skip' in params) {
            params.offset = params.skip;
        } else if ('offset' in params) {
            params.skip = params.offset;
        }
    }
    var Constr = this;
    var paramsFiltered = params;
    this.schema.callAdapter('all', this.modelName, paramsFiltered, function (err, data) {
        if (data && data.forEach) {
            if (params && params.attributes && data && data.length) {
                if ('string' === typeof params.attributes) {
                    return cb(err, data.map(function(n) {
                        return n[params.attributes];
                    }));
                } else if ('function' === typeof data.map) {
                    var isClean = Object.getOwnPropertyNames(data[0]).every(function(key) {
                        return params.attributes.indexOf(key) !== -1;
                    });
                    if (!isClean) {
                        data.forEach(function(node) {
                            Object.keys(node).forEach(function(key) {
                                if (params.attributes.indexOf(key) === -1) {
                                    delete node[key];
                                }
                            });
                        });
                    }
                }
            }
            if (!params || !params.onlyKeys) {
                data.forEach(function (d, i) {
                    var obj = new Constr();
                    d = Constr._fromDB(d);
                    obj._initProperties(d, false);
                    if (params && params.include && params.collect) {
                        data[i] = obj.__cachedRelations[params.collect];
                    } else {
                        data[i] = obj;
                    }
                });
            }
            if (data && data.countBeforeLimit) {
                data.countBeforeLimit = data.countBeforeLimit;
            }
            cb(err, data);
        } else {
            cb(err, []);
        }
    });
};

/**
 * Iterate through dataset and perform async method iterator. This method
 * designed to work with large datasets loading data by batches.
 *
 * @param {Object} filter - query conditions. Same as for `all` may contain
 * optional member `batchSize` to specify size of batch loaded from db. Optional.
 * @param {Function} iterator - method(obj, next) called on each obj.
 * @param {Function} callback - method(err) called on complete or error.
 */
AbstractClass.iterate = function map(filter, iterator, callback) {
    var Model = this;
    if ('function' === typeof filter) {
        if ('function' === typeof iterator) {
            callback = iterator;
        }
        iterator = filter;
        filter = {};
    }

    var concurrent = filter.concurrent;
    delete filter.concurrent;
    var limit = filter.limit;
    var batchSize = filter.limit = filter.batchSize || 1000;
    var batchNumber = filter.batchNumber || -1;

    nextBatch();

    function nextBatch() {
        // console.log(batchNumber);
        batchNumber += 1;
        filter.skip = filter.offset = batchNumber * batchSize;
        if (limit < batchSize) {
            if (limit <= 0) {
                return done();
            } else {
                filter.limit = limit;
            }
        }
        limit -= batchSize;
        Model.all(filter).then(function(collection) {
            if (collection.length === 0) {
                return done();
            }
            var i = 0, wait;
            if (concurrent) {
                wait = collection.length;
                collection.forEach(function(obj, i) {
                    iterator(obj, next, filter.offset + i);
                    obj = null;
                });
                collection = null;
            } else {
                nextItem();
            }
            function next() {
                if (--wait === 0) {
                    nextBatch();
                }
            }
            function nextItem(err) {
                if (err) {
                    return done(err);
                }
                var item = collection[i];
                if (i > collection.length - 1) {
                    return nextBatch();
                }
                i += 1;
                setImmediate(function() {
                    iterator(item, nextItem, filter.offset + i);
                });
            }
        }).catch(done);
    }

    function done(err) {
        if ('function' === typeof callback) {
            callback(err);
        }
    }
};

/**
 * Find one record, same as `all`, limited by 1 and return object, not collection
 *
 * @param {Object} params - search conditions: {where: {test: 'me'}}
 * @param {Function} cb - callback called with (err, instance)
 */
AbstractClass.findOne = function findOne(params, cb) {

    if (typeof params === 'function') {
        cb = params;
        params = {};
    }
    params.limit = 1;
    this.all(params, function (err, collection) {
        if (err || !collection || collection.length < 1) {
            return cb(err, null);
        }
        cb(err, collection[0]);
    });
};

/**
 * Destroy all records
 * @param {Function} cb - callback called with (err)
 */
AbstractClass.destroyAll = function destroyAll(cb) {
    this.schema.callAdapter('destroyAll', this.modelName, function(err) {
        cb(err);
    });
};

/**
 * Return count of matched records
 *
 * @param {Object} where - search conditions (optional)
 * @param {Function} cb - callback, called with (err, count)
 */
AbstractClass.count = function (where, cb) {
    if (typeof where === 'function') {
        cb = where;
        where = null;
    }
    this.schema.callAdapter('count', this.modelName, where, cb);
};

/**
 * Return string representation of class
 *
 * @override default toString method
 */
AbstractClass.toString = function () {
    return '[Model ' + this.modelName + ']';
};

/**
 * Save instance. When instance haven't id, create method called instead.
 * Triggers: validate, save, update | create
 * @param options {validate: true, throws: false} [optional]
 * @param callback(err, obj)
 */
AbstractClass.prototype.save = function (options, callback) {

    if (typeof options == 'function') {
        callback = options;
        options = {};
    }

    options = options || {};

    if (!('validate' in options)) {
        options.validate = true;
    }
    if (!('throws' in options)) {
        options.throws = false;
    }

    var inst = this;
    var data = inst.toObject(true);
    var Model = this.constructor;
    var modelName = Model.modelName;

    if (!this.id) {
        // Pass options and this to create
        data = {
            data: this,
            options: options
        };
        return Model.create(data, callback);
    }

    // validate first
    if (!options.validate) {
        return save();
    }

    inst.isValid(function (err, valid) {
        if (valid) {
            return save();
        }
        err = err || new ValidationError(inst);
        // throws option is dangerous for async usage
        if (options.throws) {
            throw err;
        }
        if ('function' === typeof callback) {
            callback.call(inst, err);
        }
    }, data);

    // then save
    function save() {
        inst.trigger('save', function(saveDone) {
            inst.trigger('update', function(updateDone) {
                inst.schema.callAdapter('save', modelName, data, function (err) {
                    if (err) {
                        return callback && callback(err, inst);
                    }
                    inst._initProperties(data, false);
                    updateDone.call(inst, function () {
                        saveDone.call(inst, function () {
                            if ('function' === typeof callback) {
                                callback.call(inst, err, inst);
                            }
                        });
                    });
                });
            }, data, callback);
        }, data, callback);
    }
};

AbstractClass.prototype.isNewRecord = function () {
    return !this.id;
};

/**
 * Convert instance to Object
 *
 * @param {Boolean} onlySchema - restrict properties to schema only, default false
 * when onlySchema == true, only properties defined in schema returned,
 * otherwise all enumerable properties returned.
 * @param {Boolean} cachedRelations - include cached relations to object, only
 * taken into account when onlySchema is false.
 * @returns {Object} - canonical object representation (no getters and setters).
 */
AbstractClass.prototype.toObject = function (onlySchema, cachedRelations) {
    var data = {};
    var ds = this.constructor.schema.definitions[this.constructor.modelName];
    var properties = ds.properties;
    var self = this;

    this.constructor.forEachProperty(function (attr) {
        if (self[attr] instanceof List) {
            data[attr] = self[attr].toObject();
        } else if (self.__data.hasOwnProperty(attr)) {
            data[attr] = self[attr];
        } else {
            data[attr] = null;
        }
    });

    if (!onlySchema) {
        Object.keys(self).forEach(function (attr) {
            if (!data.hasOwnProperty(attr)) {
                data[attr] = self[attr];
            }
        });

        if (cachedRelations === true && this.__cachedRelations) {
            var relations = this.__cachedRelations;
            Object.keys(relations).forEach(function (attr) {
                if (!data.hasOwnProperty(attr)) {
                    data[attr] = relations[attr];
                }
            });
        }
    }

    return data;
};

// AbstractClass.prototype.hasOwnProperty = function (prop) {
//     return this.__data && this.__data.hasOwnProperty(prop) ||
//         Object.getOwnPropertyNames(this).indexOf(prop) !== -1;
// };

AbstractClass.prototype.toJSON = function () {
    return this.toObject(false, true);
};


/**
 * Delete object from persistence
 *
 * @triggers `destroy` hook (async) before and after destroying object
 */
AbstractClass.prototype.destroy = function (cb) {

    this.trigger('destroy', function (destroyed) {
        this.schema.callAdapter('destroy', this.constructor.modelName, this.id, function (err) {
            if (err) {
                return cb(err);
            }

            destroyed(function () {
                if(cb) cb();
            });
        }.bind(this));
    }, this.toObject(), cb);
};

/**
 * Update single attribute
 *
 * equals to `updateAttributes({name: value}, cb)
 *
 * @param {String} name - name of property
 * @param {Mixed} value - value of property
 * @param {Function} callback - callback called with (err, instance)
 */
AbstractClass.prototype.updateAttribute = function updateAttribute(name, value, callback) {
    var data = {};
    data[name] = value;
    this.updateAttributes(data, callback);
};

/**
 * Update set of attributes
 *
 * this method performs validation before updating
 *
 * @trigger `validation`, `save` and `update` hooks
 * @param {Object} data - data to update
 * @param {Function} callback - callback called with (err, instance)
 */
AbstractClass.prototype.updateAttributes = function updateAttributes(data, callback) {

    var inst = this;
    var modelName = this.constructor.modelName;

    if (typeof data === 'function') {
        callback = data;
        data = null;
    }

    if (!data) {
        data = {};
    }

    // update instance's properties
    Object.keys(data).forEach(function (key) {
        inst[key] = data[key];
    });

    inst.isValid(function (err, valid) {
        if (!valid) {
            err = err || new ValidationError(inst);
            if (callback) {
                callback.call(inst, err);
            }
        } else {
            inst.trigger('save', function (saveDone) {
                inst.trigger('update', function (done) {

                    Object.keys(data).forEach(function (key) {
                        inst[key] = data[key];
                    });

                    inst.schema.callAdapter('updateAttributes', modelName, inst.id, inst.toObject(true), function (err) {
                        if (!err) {
                            // update _was attrs
                            Object.keys(data).forEach(function (key) {
                                inst.__dataWas[key] = inst.__data[key];
                            });
                        }
                        done.call(inst, function () {
                            saveDone.call(inst, function () {
                                if (callback) {
                                    callback.call(inst, err, inst);
                                }
                            });
                        });
                    });
                }, data, callback);
            }, data, callback);
        }
    }, data);
};

AbstractClass.prototype.fromObject = function (obj) {
    Object.keys(obj).forEach(function (key) {
        this[key] = obj[key];
    }.bind(this));
};

/**
 * Checks is property changed based on current property and initial value
 *
 * @param {String} attr - property name
 * @return Boolean
 */
AbstractClass.prototype.propertyChanged = function propertyChanged(attr) {
    return this.__data[attr] !== this.__dataWas[attr];
};

/**
 * Reload object from persistence
 *
 * @requires `id` member of `object` to be able to call `find`
 * @param {Function} callback - called with (err, instance) arguments
 */
AbstractClass.prototype.reload = function reload(callback) {

    this.constructor.find(this.id, callback);
};

/**
 * Reset dirty attributes
 *
 * this method does not perform any database operation it just reset object to it's
 * initial state
 */
AbstractClass.prototype.reset = function () {
    var obj = this;
    Object.keys(obj).forEach(function (k) {
        if (k !== 'id' && !obj.constructor.schema.definitions[obj.constructor.modelName].properties[k]) {
            delete obj[k];
        }
        if (obj.propertyChanged(k)) {
            obj[k] = obj[k + '_was'];
        }
    });
};

AbstractClass.prototype.inspect = function () {
    return util.inspect(this.__data, false, 4, true);
};

promisedClassMethods.forEach(function(methodName) {
    AbstractClass[methodName] = wrapWithPromise(AbstractClass[methodName], true);
});

promisedInstanceMethods.forEach(function(methodName) {
    AbstractClass.prototype[methodName] = wrapWithPromise(AbstractClass.prototype[methodName]);
});

function wrapWithPromise(fn, isClassMethod) {
    return function promisedWrap() {
        var args = [].slice.call(arguments);
        var callback = 'function' === typeof args[args.length - 1] ? args.pop() : null;
        var self = this;
        var Model = isClassMethod ? self : self.constructor;
        var queryResult;
        var promisedQuery = connection(Model.schema)
            .then(function() {
                return new when.Promise(function(resolve, reject) {
                    args.push(function(err, result) {
                        queryResult = result;
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                    fn.apply(self, args);
                });
            });
        if (callback) {
            promisedQuery.then(function(result) {
                callback(null, result);
            }, function(err) {
                if ('undefined' !== queryResult) {
                    callback(err, queryResult);
                } else {
                    callback(err);
                }
            });
        } else {
            return promisedQuery;
        }
    };
}

/**
 * Check whether `s` is not undefined
 * @param {Mixed} s
 * @return {Boolean} s is undefined
 */
function isdef(s) {
    var undef;
    return s !== undef;
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
