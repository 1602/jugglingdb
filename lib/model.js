/**
 * Module exports class Model
 */
module.exports = AbstractClass;

/**
 * Module dependencies
 */
const setImmediate = global.setImmediate || process.nextTick;
const util = require('util');
const assert = require('assert');
const { ValidationError } = require('./validations.js');
require('./hooks.js');
require('./relations.js');
require('./include.js');

const BASE_TYPES = ['String', 'Boolean', 'Number', 'Date', 'Text'];

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

const promisedClassMethods = [
    'create', 'all',
    'destroyAll', 'upsert',
    'updateOrCreate', 'findOrCreate',
    'find', 'update', 'bulkUpdate',
    'findOne', 'exists', 'count'
];

const promisedInstanceMethods = [
    'save', 'updateAttribute', 'updateAttributes', 'destroy', 'reload'
];

AbstractClass.prototype._initProperties = function(data, applySetters) {
    const self = this;
    const ctor = this.constructor;
    const ds = ctor.schema.definitions[ctor.modelName];
    const properties = ds.properties;
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

    Object.keys(data).forEach(i => {
        if (i in properties) {
            this.__data[i] = this.__dataWas[i] = data[i];
        } else if (i in ctor.relations) {
            this.__data[ctor.relations[i].keyFrom] = this.__dataWas[i] = data[i][ctor.relations[i].keyTo];
            this.__cachedRelations[i] = data[i];
        }
    });

    if (applySetters === true) {
        Object.keys(data).forEach(attr => {
            self[attr] = data[attr];
        });
    }

    ctor.forEachProperty(attr => {

        if (typeof self.__data[attr] === 'undefined') {
            self.__data[attr] = self.__dataWas[attr] = getDefault(attr);
        } else {
            self.__dataWas[attr] = self.__data[attr];
        }

    });

    ctor.forEachProperty(attr => {

        const type = properties[attr].type;

        if (BASE_TYPES.indexOf(type.name) === -1) {
            if (typeof self.__data[attr] !== 'object' && self.__data[attr]) {
                try {
                    self.__data[attr] = JSON.parse(self.__data[attr] + '');
                } catch (e) {
                    self.__data[attr] = String(self.__data[attr]);
                }
            }
            if (type.name === 'Array' || typeof type === 'object' && type.constructor.name === 'Array') {
                self.__data[attr] = JSON.parse(self.__data[attr] + '');
            }
        }

    });

    function getDefault(attr) {
        const def = properties[attr]['default'];
        if (isdef(def)) {
            if (typeof def === 'function') {
                return def();
            }
            return def;
        }
        return undefined;
    }

    this.trigger('initialize');
};

/**
 * @param {String} prop - property name
 * @param {Object} params - various property configuration
 */
AbstractClass.defineProperty = function(prop, params) {
    this.schema.defineProperty(this.modelName, prop, params);
};

/**
 * Updates the respective record
 *
 * @param {Object} params - { where:{uid:'10'}, update:{ Name:'New name' } }
 * @param callback(err, obj)
 */
AbstractClass.update = function(id, data, cb) {
    const Model = this;

    if (typeof id === 'object' && arguments.length === 2 && typeof data === 'function') {
        return util.deprecate(() => { Model.bulkUpdate(id, data); }, 'Model.update({update: ..., where: ...}): use Model.bulkUpdate instead')();
    }

    Model.bulkUpdate({ where: { id }, limit: 1, update: data }, cb);
};

/**
 * Update records
 *
 * @param {Object} params - { where: { uid: '10'}, update: { Name: 'New name' }, limit: 1}
 *   - update {Object}: data to update
 *   - where {Object}: same as for Model.all, required
 *   - limit {Number}: same as for Model.all, optional
 *   - skip {Number}: same as for Model.all, optional
 * @param callback(err, obj)
 */
AbstractClass.bulkUpdate = function(params, cb) {
    const Model = this;
    if (params instanceof Array) {
        return Promise.all(params.map(param => {
            return Model.bulkUpdate(param);
        }))
            .then(res => cb(null, res))
            .catch(err => cb(err));
    }

    assert(params.update, 'Required update');
    assert(params.where, 'Required where');

    return this.schema.callAdapter('update', this.modelName, params, cb);
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
AbstractClass.create = function(data, callback) {

    const Model = this;
    const modelName = Model.modelName;

    if (typeof data === 'function') {
        callback = data;
        data = {};
    }

    data = data || {};

    // Passed via data from save
    const options = data.options || { validate: true };

    if (data.data instanceof Model) {
        data = data.data;
        data.__dataWas = data.__data;
    }

    let errors, gotError, instances, wait;

    if (data instanceof Array) {
        instances = Array(data.length);
        errors = Array(data.length);
        gotError = false;
        wait = data.length;
        if (wait === 0) {
            callback(null, []);
        }

        for (let i = 0; i < data.length; i += 1) {
            createModel(data[i], i);
        }

        return instances;
    }

    function createModel(d, i) {
        Model.create(d, (err, inst) => {
            if (err) {
                errors[i] = err;
                gotError = true;
            }

            instances[i] = inst;
            modelCreated();
        });
    }

    function modelCreated() {
        wait += -1;
        if (wait === 0) {
            callback(gotError ? errors : null, instances);
        }
    }

    let obj;
    // if we come from save
    if (data instanceof Model && !data.id) {
        obj = data;
    } else {
        obj = new Model(data);
    }
    data = obj.toObject(true);

    if (!options.validate) {
        create();
    } else {
        // validation required
        obj.isValid((err, valid) => {
            if (valid) {
                create();
            } else {
                err = err || new ValidationError(obj);
                callback(err, obj);
            }
        }, data);
    }

    function create() {
        obj.trigger('create', createDone => {
            obj.trigger('save', function(saveDone) {
                createAndTearDown(this, saveDone, createDone);
            }, obj, callback);
        }, obj, callback);
    }

    function createAndTearDown(inst, saveDone, createDone) {
        inst.schema.callAdapter('create', modelName, obj.toObject(true), (err, id, rev) => {
            if (id) {
                obj.__data.id = id;
                obj.__dataWas.id = id;
                defineReadonlyProp(obj, 'id', id);
            }

            if (rev) {
                obj._rev = rev;
            }

            // if error occurs, we should not return a valid obj
            if (err) {
                return callback(err, obj);
            }

            saveDone.call(obj, () => {
                createDone.call(obj, () => {
                    callback(err, obj);
                });
            });
        });
    }

    return obj;
};

function connection(schema) {
    if (schema.connected) {
        return Promise.resolve();
    }

    if (schema.connecting) {
        return new Promise(resolve =>
            schema.once('connected', () => resolve())
        );
    }

    return schema.connect();
}

/**
 * Update or insert
 */
AbstractClass.upsert = AbstractClass.updateOrCreate = function upsert(data, callback) {

    const Model = this;
    if (!data.id) {
        return this.create(data, callback);
    }

    if (this.schema.adapter.updateOrCreate) {
        const inst = new Model(data);
        this.schema.callAdapter('updateOrCreate', Model.modelName, stripUndefined(inst.toObject(true)), (err, data) => {
            if (data) {
                return inst.reload(callback);
            }
            callback(err, null);
        });
    } else {
        this.find(data.id, (err, inst) => {
            if (err) {
                return callback(err);
            }

            if (inst) {
                inst.updateAttributes(data, callback);
            } else {
                const obj = new Model(data);
                obj.save(data, callback);
            }
        });
    }

    function stripUndefined(data) {
        return Object.keys(data)
            .filter(key => typeof data[key] !== 'undefined')
            .reduce((result, key) => {
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
    if (typeof data === 'function' || typeof data === 'undefined') {
        callback = data;
        data = query && query.where;
    }

    if (typeof query === 'function') {
        callback = query;
        query = { where: {} };
    }

    const t = this;
    this.findOne(query)
        .then(record => {
            if (record) {
                return callback(null, record);
            }

            t.create(data, callback);
        })
        .catch(callback);
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
    const Model = this;

    this.schema.callAdapter('find', Model.modelName, id, (err, data) => {
        let obj = null;
        if (data) {
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
 * Find object by id, throw error with code not_found if not found
 *
 * @param {id} id - primary key value
 * @param {Function} cb - callback called with (err, instance)
 */
AbstractClass.fetch = function fetch(id) {
    return this.find(id)
        .then(inst => {
            if (inst) {
                return inst;
            }

            const error = new Error('Not found');
            error.code = 'not_found';
            error.details = { id };
            throw error;
        });
};

AbstractClass.expand = function(object) {
    return Object.assign({}, object, {
        pets: [{}]
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
    const Constr = this;
    const paramsFiltered = params;
    this.schema.callAdapter('all', this.modelName, paramsFiltered, (err, data) => {
        if (data && data.forEach) {
            if (params && params.attributes && data && data.length) {
                if (typeof params.attributes === 'string') {
                    return cb(err, data.map(n => n[params.attributes]));
                } else if (typeof data.map === 'function') {
                    const isClean = Object.getOwnPropertyNames(data[0]).every(key => {
                        return params.attributes.indexOf(key) !== -1;
                    });

                    if (!isClean) {
                        data.forEach(node => {
                            Object.keys(node).forEach(key => {
                                if (params.attributes.indexOf(key) === -1) {
                                    delete node[key];
                                }
                            });
                        });
                    }
                }
            }
            if (!params || !params.onlyKeys) {
                data.forEach((d, i) => {
                    const obj = new Constr();
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
    const Model = this;
    if (typeof filter === 'function') {
        if (typeof iterator === 'function') {
            callback = iterator;
        }
        iterator = filter;
        filter = {};
    }

    const concurrent = filter.concurrent;
    delete filter.concurrent;
    let limit = filter.limit;
    const batchSize = filter.limit = filter.batchSize || 1000;
    let batchNumber = filter.batchNumber || -1;

    nextBatch();

    function nextBatch() {
        // console.log(batchNumber);
        batchNumber += 1;
        filter.skip = filter.offset = batchNumber * batchSize;
        if (limit < batchSize) {
            if (limit <= 0) {
                return done();
            }
            filter.limit = limit;
        }
        limit -= batchSize;
        Model.all(filter).then(collection => {
            if (collection.length === 0) {
                return done();
            }
            let i = 0, wait;
            if (concurrent) {
                wait = collection.length;
                collection.forEach((obj, i) => {
                    iterator(obj, next, filter.offset + i);
                    obj = null;
                });
                collection = null;
            } else {
                nextItem();
            }
            function next() {
                wait += -1;
                if (wait === 0) {
                    nextBatch();
                }
            }
            function nextItem(err) {
                if (err) {
                    return done(err);
                }
                const item = collection[i];
                if (i > collection.length - 1) {
                    return nextBatch();
                }
                i += 1;
                setImmediate(() => iterator(item, nextItem, filter.offset + i));
            }
        }).catch(done);
    }

    function done(err) {
        if (typeof callback === 'function') {
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
    this.all(params, (err, collection) => {
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
    this.schema.callAdapter('destroyAll', this.modelName, err => cb(err));
};

/**
 * Return count of matched records
 *
 * @param {Object} where - search conditions (optional)
 * @param {Function} cb - callback, called with (err, count)
 */
AbstractClass.count = function(where, cb) {
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
AbstractClass.toString = function() {
    return '[Model ' + this.modelName + ']';
};

/**
 * Save instance. When instance haven't id, create method called instead.
 * Triggers: validate, save, update | create
 * @param options {validate: true, throws: false} [optional]
 * @param callback(err, obj)
 */
AbstractClass.prototype.save = function(options, callback) {

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

    const inst = this;
    let data = inst.toObject(true);
    const Model = this.constructor;
    const modelName = Model.modelName;

    if (!this.id) {
        // Pass options and this to create
        data = {
            data: this,
            options
        };
        return Model.create(data, callback);
    }

    // validate first
    if (!options.validate) {
        return save();
    }

    inst.isValid((err, valid) => {
        if (valid) {
            return save();
        }
        err = err || new ValidationError(inst);
        // throws option is dangerous for async usage
        if (options.throws) {
            throw err;
        }
        if (typeof callback === 'function') {
            callback.call(inst, err);
        }
    }, data);

    // then save
    function save() {
        inst.trigger('save', saveDone =>
            inst.trigger('update', updateDone =>
                updateAndTearDown(inst, updateDone, saveDone)
            , data, callback)
        , data, callback);
    }

    // TODO: revisit hooks model
    function updateAndTearDown(inst, updateDone, saveDone) {
        inst.schema.callAdapter('save', modelName, data, err => {
            if (err) {
                return callback && callback(err, inst);
            }

            inst._initProperties(data, false);
            updateDone.call(inst, () => {
                saveDone.call(inst, () => {
                    if (typeof callback === 'function') {
                        callback.call(inst, err, inst);
                    }
                });
            });
        });
    }
};

AbstractClass.prototype.isNewRecord = function() {
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
AbstractClass.prototype.toObject = function(onlySchema, cachedRelations) {
    const data = {};
    const self = this;

    this.constructor.forEachProperty(attr => {
        if (self.__data.hasOwnProperty(attr)) {
            data[attr] = self[attr];
        } else {
            data[attr] = null;
        }
    });

    if (!onlySchema) {
        Object.keys(self).forEach(attr => {
            if (!data.hasOwnProperty(attr)) {
                data[attr] = self[attr];
            }
        });

        if (cachedRelations === true && this.__cachedRelations) {
            const relations = this.__cachedRelations;
            Object.keys(relations).forEach(attr => {
                if (!data.hasOwnProperty(attr)) {
                    data[attr] = relations[attr];
                }
            });
        }
    }

    return data;
};

// AbstractClass.prototype.hasOwnProperty = function(prop) {
//     return this.__data && this.__data.hasOwnProperty(prop) ||
//         Object.getOwnPropertyNames(this).indexOf(prop) !== -1;
// };

AbstractClass.prototype.toJSON = function() {
    return this.toObject(false, true);
};


/**
 * Delete object from persistence
 *
 * @triggers `destroy` hook (async) before and after destroying object
 */
AbstractClass.prototype.destroy = function(cb) {

    this.trigger('destroy', function(destroyed) {
        this.schema.callAdapter('destroy', this.constructor.modelName, this.id, err => {
            if (err) {
                return cb(err);
            }

            destroyed(() => {
                if (cb) {
                    cb();
                }
            });
        });
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
    const data = {};
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

    const inst = this;
    const modelName = this.constructor.modelName;

    // update instance's properties
    Object.keys(data).forEach(key => inst[key] = data[key]);

    inst.isValid((err, valid) => {

        if (!valid) {
            err = err || new ValidationError(inst);
            if (callback) {
                callback.call(inst, err);
            }
            return;
        }

        inst.trigger('save', saveDone =>
            inst.trigger('update', updateDone =>
                saveAndTearDown(updateDone, saveDone)
            , data, callback)
        , data, callback);
    }, data);

    function saveAndTearDown(updateDone, saveDone) {
        Object.keys(data).forEach(key => inst[key] = data[key]);

        inst.schema.callAdapter('updateAttributes', modelName, inst.id, inst.toObject(true), err => {
            if (!err) {
                // update _was attrs
                Object.keys(data).forEach(key => {
                    inst.__dataWas[key] = inst.__data[key];
                });
            }

            updateDone.call(inst, () => {
                saveDone.call(inst, () => {
                    if (callback) {
                        callback.call(inst, err, inst);
                    }
                });
            });
        });
    }
};

AbstractClass.prototype.fromObject = function(obj) {
    Object.keys(obj).forEach(key => this[key] = obj[key]);
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

AbstractClass.prototype.inspect = function() {
    return util.inspect(this.__data, false, 4, true);
};

promisedClassMethods.forEach(methodName => {
    AbstractClass[methodName] = wrapWithPromise(AbstractClass[methodName], true);
});

promisedInstanceMethods.forEach(methodName => {
    AbstractClass.prototype[methodName] = wrapWithPromise(AbstractClass.prototype[methodName]);
});

function wrapWithPromise(fn, isClassMethod) {
    return function promisedWrap() {
        const args = [].slice.call(arguments);
        const callback = typeof args[args.length - 1] === 'function'
            ? args.pop()
            : null;

        const self = this;
        const Model = isClassMethod ? self : self.constructor;
        let queryResult;
        const promisedQuery = connection(Model.schema)
            .then(() => {
                return new Promise((resolve, reject) => {
                    args.push((err, result) => {
                        queryResult = result;
                        if (err) {
                            return reject(err);
                        }
                        resolve(result);
                    });
                    fn.apply(self, args);
                });
            });

        if (callback) {
            promisedQuery.then(result => callback(null, result), err => {
                if (queryResult !== 'undefined') {
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
    return typeof s !== 'undefined';
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
        value
    });
}
