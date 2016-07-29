/**
 * Module exports
 */
exports.defineScope = defineScope;

/**
 * Scope mixin for ./model.js
 */
const Model = require('./model.js');
const when = require('when');

/**
 * Define scope
 * TODO: describe behavior and usage examples
 */
Model.scope = function(name, params) {
    defineScope(this, this, name, params);
};

function defineScope(cls, targetClass, name, params, methods) {

    // collect meta info about scope
    if (!cls._scopeMeta) {
        cls._scopeMeta = {};
    }

    // only makes sence to add scope in meta if base and target classes
    // are same
    if (cls === targetClass) {
        cls._scopeMeta[name] = params;
    } else if (!targetClass._scopeMeta) {
        targetClass._scopeMeta = {};
    }

    Object.defineProperty(cls, name, {
        enumerable: false,
        configurable: true,
        get() {
            const f = function caller(condOrRefresh, cb) {
                let actualCond;
                if (typeof condOrRefresh === 'function') {
                    cb = condOrRefresh;
                    actualCond = {};
                    condOrRefresh = null;
                } else if (typeof condOrRefresh === 'object') {
                    actualCond = condOrRefresh;
                } else {
                    actualCond = {};
                }

                const cached = this.__cachedRelations && this.__cachedRelations[name];
                if (cached && !condOrRefresh) {
                    if (typeof cb === 'function') {
                        return cb(null, cached);
                    }
                    return when.resolve(cached);
                }

                const self = this;
                const params = mergeParams(actualCond, caller._scope);
                return targetClass.all(params)
                    .then(data => {
                        if (!self.__cachedRelations) {
                            self.__cachedRelations = {};
                        }
                        self.__cachedRelations[name] = data;
                        if (typeof cb === 'function') {
                            cb(null, data);
                        } else {
                            return data;
                        }
                    })
                    .catch(err => {
                        if (typeof cb === 'function') {
                            cb(err);
                        } else {
                            throw err;
                        }
                    });
            };
            f._scope = typeof params === 'function' ? params.call(this) : params;
            f.build = build;
            f.create = create;
            f.destroyAll = destroyAll;
            const inst = this;
            if (methods) {
                Object.keys(methods).forEach(key => {
                    f[key] = methods[key].bind(inst);
                });
            }

            // define sub-scopes
            Object.keys(targetClass._scopeMeta).forEach(name => {
                Object.defineProperty(f, name, {
                    enumerable: false,
                    get() {
                        mergeParams(f._scope, targetClass._scopeMeta[name]);
                        return f;
                    }
                });
            });
            return f;
        }
    });

    // and it should have create/build methods with binded thisModelNameId param
    function build(data) {
        return new targetClass(mergeParams(this._scope, { where:data || {} }).where);
    }

    function create(data, cb) {
        if (typeof data === 'function') {
            cb = data;
            data = {};
        }
        return this.build(data).save(cb);
    }

    /*
        Callback
        - The callback will be called after all elements are destroyed
        - For every destroy call which results in an error
        - If fetching the Elements on which destroyAll is called results in an error
    */
    function destroyAll(cb) {
        targetClass.all(this._scope, (err, data) => {
            if (err) {
                cb(err);
            } else {
                (function loopOfDestruction(data) {
                    if (data.length > 0) {
                        data.shift().destroy(err => {
                            if (err && cb) {
                                cb(err);
                            }
                            loopOfDestruction(data);
                        });
                    } else if (cb) {
                        cb();
                    }
                }(data));
            }
        });
    }

    function mergeParams(base, update) {
        if (update.where) {
            base.where = merge(base.where, update.where);
        }
        if (update.include) {
            base.include = update.include;
        }
        if (update.collect) {
            base.collect = update.collect;
        }

        // overwrite order
        if (update.order) {
            base.order = update.order;
        }

        return base;

    }
}

/**
 * Merge `base` and `update` params
 * @param {Object} base - base object (updating this object)
 * @param {Object} update - object with new data to update base
 * @returns {Object} `base`
 */
function merge(base, update) {
    base = base || {};

    if (update) {
        Object.keys(update).forEach(key => base[key] = update[key]);
    }

    return base;
}

