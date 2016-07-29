/**
 * Dependencies
 */
const i8n = require('inflection');
const defineScope = require('./scope.js').defineScope;

/**
 * Relations mixins for ./model.js
 */
const Model = require('./model.js');

Model.relationNameFor = function relationNameFor(foreignKey) {
    let found;
    Object.keys(this.relations).forEach(rel => {
        if (this.relations[rel].type === 'belongsTo' && this.relations[rel].keyFrom === foreignKey) {
            found = rel;
        }
    });
    return found;
};

/**
 * Declare hasMany relation
 *
 * @param {Model} anotherClass - class to has many
 * @param {Object} params - configuration {as:, foreignKey:}
 * @example `User.hasMany(Post, {as: 'posts', foreignKey: 'authorId'});`
 */
Model.hasMany = function hasMany(anotherClass, params) {
    const thisClassName = this.modelName;
    params = params || {};
    if (typeof anotherClass === 'string') {
        params.as = anotherClass;
        if (params.model) {
            anotherClass = params.model;
        } else {
            const anotherClassName = i8n.singularize(anotherClass).toLowerCase();
            Object.keys(this.schema.models).forEach(name => {
                if (name.toLowerCase() === anotherClassName) {
                    anotherClass = this.schema.models[name];
                }
            });
        }
    }
    const methodName = params.as ||
        i8n.camelize(i8n.pluralize(anotherClass.modelName), true);
    const fk = params.foreignKey || i8n.camelize(thisClassName + '_id', true);

    this.relations[methodName] = {
        type: 'hasMany',
        keyFrom: 'id',
        keyTo: fk,
        modelTo: anotherClass,
        multiple: true
    };
    // each instance of this class should have method named
    // pluralize(anotherClass.modelName)
    // which is actually just anotherClass.all({where: {thisModelNameId: this.id}}, cb);
    const scopeMethods = {
        find,
        destroy
    };

    let fk2;

    if (params.through) {

        // Append through relation, like modelTo
        this.relations[methodName].modelThrough = params.through;

        fk2 = i8n.camelize(anotherClass.modelName + '_id', true);
        scopeMethods.create = function create(data, done) {
            if (typeof data !== 'object') {
                done = data;
                data = {};
            }
            const self = this;
            return anotherClass.create(data)
                .then(ac => {
                    const d = {};
                    d[params.through.relationNameFor(fk)] = self;
                    d[params.through.relationNameFor(fk2)] = ac;
                    return params.through.create(d)
                        .then(() => ac)
                        .catch(e => {
                            return ac.destroy()
                                .then(() => {
                                    throw e;
                                });
                        });
                })
                .then(ac => {
                    if (typeof done === 'function') {
                        done(null, ac);
                    } else {
                        return ac;
                    }
                })
                .catch(err => {
                    if (typeof done === 'function') {
                        done(err);
                    } else {
                        throw err;
                    }
                });
        };
        scopeMethods.add = function(acInst, data, done) {
            if (typeof data === 'function') {
                done = data;
                data = {};
            }
            if (typeof data === 'undefined') {
                data = {};
            }
            const query = {};
            query[fk] = this.id;
            data[params.through.relationNameFor(fk)] = this;
            query[fk2] = acInst.id || acInst;
            data[params.through.relationNameFor(fk2)] = acInst;
            return params.through.findOrCreate({ where: query }, data)
                .then(through => {
                    if (typeof done === 'function') {
                        done(null, through);
                    } else {
                        return through;
                    }
                })
                .catch(err => {
                    if (typeof done === 'function') {
                        done(err);
                    } else {
                        throw err;
                    }
                });
        };
        scopeMethods.remove = function(acInst, done) {
            const q = {};
            q[fk] = this.id;
            q[fk2] = acInst.id || acInst;
            return params.through.findOne({ where: q })
                .then(d => {
                    if (d) {
                        return d.destroy();
                    }
                })
                .then(() => {
                    if (typeof done === 'function') {
                        done();
                    }
                })
                .catch(e => {
                    if (typeof done === 'function') {
                        done(e);
                    } else {
                        throw e;
                    }
                });
        };
        delete scopeMethods.destroy;
    }

    defineScope(this.prototype, params.through || anotherClass, methodName, function() {
        const filter = {};
        filter.where = {};
        filter.where[fk] = this.id;
        if (params.through) {
            filter.collect = i8n.camelize(anotherClass.modelName, true);
            filter.include = filter.collect;
        }
        return filter;
    }, scopeMethods);

    if (!params.through) {
        // obviously, anotherClass should have attribute called `fk`
        anotherClass.schema.defineForeignKey(anotherClass.modelName, fk, this.modelName);
    }

    function find(id, cb) {
        const id_ = this.id;
        return anotherClass.find(id)
            .then(inst => {
                if (!inst) {
                    throw new Error('Not found');
                }
                if (inst[fk] && inst[fk].toString() === id_.toString()) {
                    if (typeof cb === 'function') {
                        cb(null, inst);
                    } else {
                        return inst;
                    }
                } else {
                    throw new Error('Permission denied');
                }
            })
            .catch(err => {
                if (typeof cb === 'function') {
                    cb(err);
                } else {
                    throw err;
                }
            });
    }

    function destroy(id, cb) {
        const id_ = this.id;
        return anotherClass.find(id)
            .then(inst => {
                if (!inst) {
                    throw new Error('Not found');
                }
                if (inst[fk] && inst[fk].toString() === id_.toString()) {
                    return inst.destroy()
                        .then(() => {
                            if (typeof cb === 'function') {
                                cb();
                            }
                        });
                }
                throw new Error('Permission denied');
            })
            .catch(err => {
                if (typeof cb === 'function') {
                    cb(err);
                } else {
                    throw err;
                }
            });
    }

};

/**
 * Declare belongsTo relation
 *
 * @param {Class} anotherClass - class to belong
 * @param {Object} params - configuration {as: 'propertyName', foreignKey: 'keyName'}
 *
 * **Usage examples**
 * Suppose model Post have a *belongsTo* relationship with User (the author of the post). You could declare it this way:
 * Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
 *
 * When a post is loaded, you can load the related author with:
 * post.author(function(err, user) {
 *     // the user variable is your user object
 * });
 *
 * The related object is cached, so if later you try to get again the author, no additional request will be made.
 * But there is an optional boolean parameter in first position that set whether or not you want to reload the cache:
 * post.author(true, function(err, user) {
 *     // The user is reloaded, even if it was already cached.
 * });
 *
 * This optional parameter default value is false, so the related object will be loaded from cache if available.
 */
Model.belongsTo = function(anotherClass, params) {
    params = params || {};
    if (typeof anotherClass === 'string') {
        params.as = anotherClass;
        if (params.model) {
            anotherClass = params.model;
        } else {
            const anotherClassName = anotherClass.toLowerCase();
            Object.keys(this.schema.models).forEach(name => {
                if (name.toLowerCase() === anotherClassName) {
                    anotherClass = this.schema.models[name];
                }
            });
        }
    }
    const methodName = params.as || i8n.camelize(anotherClass.modelName, true);
    const fk = params.foreignKey || methodName + 'Id';

    this.relations[methodName] = {
        type: 'belongsTo',
        keyFrom: fk,
        keyTo: 'id',
        modelTo: anotherClass,
        multiple: false
    };

    this.schema.defineForeignKey(this.modelName, fk, anotherClass.modelName);
    this.prototype.__finders__ = this.prototype.__finders__ || {};

    this.prototype.__finders__[methodName] = function(id) {
        if (id === null || !this[fk]) {
            return Promise.resolve(null);
        }
        const fk_ = this[fk].toString();
        return anotherClass.find(id)
            .then(inst => {
                if (!inst) {
                    return null;
                }

                if (inst.id.toString() === fk_) {
                    return inst;
                }

                throw new Error('Permission denied');
            });
    };

    this.prototype[methodName] = function(p) {
        const self = this;
        const cachedValue = this.__cachedRelations && this.__cachedRelations[methodName];
        // acts as setter
        if (p instanceof Model) {
            this.__cachedRelations[methodName] = p;
            return this.updateAttribute(fk, p.id);
        }
        // acts as async getter
        if (typeof cachedValue === 'undefined') {
            return this.__finders__[methodName].call(self, this[fk])
                .then(inst => {
                    self.__cachedRelations[methodName] = inst;
                    if (typeof p === 'function') {
                        p(null, inst);
                    } else {
                        return inst;
                    }
                });
        }
        // return cached relation
        if (typeof p === 'function') {
            p(null, cachedValue);
        } else {
            return Promise.resolve(cachedValue);
        }
    };

};

/**
 * Many-to-many relation
 *
 * Post.hasAndBelongsToMany('tags'); creates connection model 'PostTag'
 */
Model.hasAndBelongsToMany = function hasAndBelongsToMany(anotherClass, params) {
    params = params || {};
    const models = this.schema.models;

    if (typeof anotherClass === 'string') {
        params.as = anotherClass;
        if (params.model) {
            anotherClass = params.model;
        } else {
            anotherClass = lookupModel(i8n.singularize(anotherClass)) ||
                anotherClass;
        }
        if (typeof anotherClass === 'string') {
            throw new Error('Could not find "' + anotherClass + '" relation for ' + this.modelName);
        }
    }

    if (!params.through) {
        const name1 = this.modelName + anotherClass.modelName;
        const name2 = anotherClass.modelName + this.modelName;
        params.through = lookupModel(name1) || lookupModel(name2) ||
            this.schema.define(name1);
    }
    params.through.belongsTo(this);
    params.through.belongsTo(anotherClass);

    this.hasMany(anotherClass, { as: params.as, through: params.through });

    function lookupModel(modelName) {
        const lookupClassName = modelName.toLowerCase();
        let found;
        Object.keys(models).forEach(name => {
            if (name.toLowerCase() === lookupClassName) {
                found = models[name];
            }
        });
        return found;
    }

};
