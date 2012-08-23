var safeRequire = require('../utils').safeRequire;

/**
 * Module dependencies
 */
var neo4j = safeRequire('neo4j');

exports.initialize = function initializeSchema(schema, callback) {
    schema.client = new neo4j.GraphDatabase(schema.settings.url);
    schema.adapter = new Neo4j(schema.client);
    process.nextTick(callback);
};

function Neo4j(client) {
    this._models = {};
    this.client = client;
    this.cache = {};
}

Neo4j.prototype.define = function defineModel(descr) {
    this.mixClassMethods(descr.model, descr.properties);
    this.mixInstanceMethods(descr.model.prototype, descr.properties);
    this._models[descr.model.modelName] = descr;
};

Neo4j.prototype.createIndexHelper = function (cls, indexName) {
    var db = this.client;
    var method = 'findBy' + indexName[0].toUpperCase() + indexName.substr(1);
    cls[method] = function (value, cb) {
        db.getIndexedNode(cls.modelName, indexName, value, function (err, node) {
            if (err) return cb(err);
            if (node) {
                node.data.id = node.id;
                cb(null, new cls(node.data));
            } else {
                cb(null, null);
            }
        });
    };
};

Neo4j.prototype.mixClassMethods = function mixClassMethods(cls, properties) {
    var neo = this;

    Object.keys(properties).forEach(function (name) {
        if (properties[name].index) {
            neo.createIndexHelper(cls, name);
        }
    });

    cls.setupCypherQuery = function (name, queryStr, rowHandler) {
        cls[name] = function cypherQuery(params, cb) {
            if (typeof params === 'function') {
                cb = params;
                params = [];
            } else if (params.constructor.name !== 'Array') {
                params = [params];
            }

            var i = 0;
            var q = queryStr.replace(/\?/g, function () {
                return params[i++];
            });

            neo.client.query(function (err, result) {
                if (err) return cb(err, []);
                cb(null, result.map(rowHandler));
            }, q);
        };
    };

    /**
     * @param from - id of object to check relation from
     * @param to - id of object to check relation to
     * @param type - type of relation
     * @param direction - all | incoming | outgoing
     * @param cb - callback (err, rel || false)
     */
    cls.relationshipExists = function relationshipExists(from, to, type, direction, cb) {
        neo.node(from, function (err, node) {
            if (err) return cb(err);
            node._getRelationships(direction, type, function (err, rels) {
                if (err && cb) return cb(err);
                if (err && !cb) throw err;
                var found = false;
                if (rels && rels.forEach) {
                    rels.forEach(function (r) {
                        if (r.start.id === from && r.end.id === to) {
                            found = true;
                        }
                    });
                }
                cb  && cb(err, found);
            });
        });
    };

    cls.createRelationshipTo = function createRelationshipTo(id1, id2, type, data, cb) {
        var fromNode, toNode;
        neo.node(id1, function (err, node) {
            if (err && cb) return cb(err);
            if (err && !cb) throw err;
            fromNode = node;
            ok();
        });
        neo.node(id2, function (err, node) {
            if (err && cb) return cb(err);
            if (err && !cb) throw err;
            toNode = node;
            ok();
        });
        function ok() {
            if (fromNode && toNode) {
                fromNode.createRelationshipTo(toNode, type, cleanup(data), cb);
            }
        }
    };

    cls.createRelationshipFrom = function createRelationshipFrom(id1, id2, type, data, cb) {
        cls.createRelationshipTo(id2, id1, type, data, cb);
    }

    // only create relationship if it is not exists
    cls.ensureRelationshipTo = function (id1, id2, type, data, cb) {
        cls.relationshipExists(id1, id2, type, 'outgoing', function (err, exists) {
            if (err && cb) return cb(err);
            if (err && !cb) throw err;
            if (exists) return cb && cb(null);
            cls.createRelationshipTo(id1, id2, type, data, cb);
        });
    }
};

Neo4j.prototype.mixInstanceMethods = function mixInstanceMethods(proto) {
    var neo = this;

    /**
     * @param obj - Object or id of object to check relation with
     * @param type - type of relation
     * @param cb - callback (err, rel || false)
     */
    proto.isInRelationWith = function isInRelationWith(obj, type, direction, cb) {
        this.constructor.relationshipExists(this.id, obj.id || obj, type, 'all', cb);
    };
};

Neo4j.prototype.node = function find(id, callback) {
    if (this.cache[id]) {
        callback(null, this.cache[id]);
    } else {
        this.client.getNodeById(id, function (err, node) {
            if (node) {
                this.cache[id] = node;
            }
            callback(err, node);
        }.bind(this));
    }
};

Neo4j.prototype.create = function create(model, data, callback) {
    data.nodeType = model;
    var node = this.client.createNode();
    node.data = cleanup(data);
    node.data.nodeType = model;
    node.save(function (err) {
        if (err) {
            return callback(err);
        }
        this.cache[node.id] = node;
        node.index(model, 'id', node.id, function (err) {
            if (err) return callback(err);
            this.updateIndexes(model, node, function (err) {
                if (err) return callback(err);
                callback(null, node.id);
            });
        }.bind(this));
    }.bind(this));
};

Neo4j.prototype.updateIndexes = function updateIndexes(model, node, cb) {
    var props = this._models[model].properties;
    var wait = 1;
    Object.keys(props).forEach(function (key) {
        if (props[key].index && node.data[key]) {
            wait += 1;
            node.index(model, key, node.data[key], done);
        }
    });

    done();

    var error = false;
    function done(err) {
        error = error || err;
        if (--wait === 0) {
            cb(error);
        }
    }
};

Neo4j.prototype.save = function save(model, data, callback) {
    var self = this;
    
    this.node(data.id, function (err, node) {
        //delete id property since that's redundant and we use the node.id
        delete data.id;
        if (err) return callback(err);
        node.data = cleanup(data);
        node.save(function (err) {
            if (err) return callback(err);
            self.updateIndexes(model, node, function (err) {
                if (err) return console.log(err);
                //map node id to the id property being sent back
                node.data.id = node.id;
                callback(null, node.data);
            });
        });
    });
};

Neo4j.prototype.exists = function exists(model, id, callback) {
    delete this.cache[id];
    this.node(id, callback);
};

Neo4j.prototype.find = function find(model, id, callback) {
    delete this.cache[id];
    this.node(id, function (err, node) {
        if (node && node.data) {
            node.data.id = id;
        }
        callback(err, this.readFromDb(model, node && node.data));
    }.bind(this));
};

Neo4j.prototype.readFromDb = function readFromDb(model, data) {
    if (!data) return data;
    var res = {};
    var props = this._models[model].properties;
    Object.keys(data).forEach(function (key) {
        if (props[key] && props[key].type.name === 'Date') {
            res[key] = new Date(data[key]);
        } else {
            res[key] = data[key];
        }
    });
    return res;
};

Neo4j.prototype.destroy = function destroy(model, id, callback) {
    var force = true;
    this.node(id, function (err, node) {
        if (err) return callback(err);
        node.delete(function (err) {
            if (err) return callback(err);
            delete this.cache[id];
        }.bind(this), force);
    });
};

Neo4j.prototype.all = function all(model, filter, callback) {
    this.client.queryNodeIndex(model, 'id:*', function (err, nodes) {
        if (nodes) {
            nodes = nodes.map(function (obj) {
                obj.data.id = obj.id;
                return this.readFromDb(model, obj.data);
            }.bind(this));
        }
        if (filter) {
            nodes = nodes ? nodes.filter(applyFilter(filter)) : nodes;
            if (filter.order) {
                var key = filter.order.split(' ')[0];
                var dir = filter.order.split(' ')[1];
                nodes = nodes.sort(function (a, b) {
                    return a[key] > b[key];
                });
                if (dir === 'DESC') nodes = nodes.reverse();
            }
        }
        callback(err, nodes);
    }.bind(this));
};

Neo4j.prototype.allNodes = function all(model, callback) {
    this.client.queryNodeIndex(model, 'id:*', function (err, nodes) {
        callback(err, nodes);
    });
};

function applyFilter(filter) {
    if (typeof filter.where === 'function') {
        return filter.where;
    }
    var keys = Object.keys(filter.where || {});
    return function (obj) {
        var pass = true;
        keys.forEach(function (key) {
            if (!test(filter.where[key], obj[key])) {
                pass = false;
            }
        });
        return pass;
    }

    function test(example, value) {
        if (typeof value === 'string' && example && example.constructor.name === 'RegExp') {
            return value.match(example);
        }
        if (typeof value === 'object' && value.constructor.name === 'Date' && typeof example === 'object' && example.constructor.name === 'Date') {
            return example.toString() === value.toString();
        }
        // not strict equality
        return example == value;
    }
}

Neo4j.prototype.destroyAll = function destroyAll(model, callback) {
    var wait, error = null;
    this.allNodes(model, function (err, collection) {
        if (err) return callback(err);
        wait = collection.length;
        collection && collection.forEach && collection.forEach(function (node) {
            node.delete(done, true);
        });
    });

    function done(err) {
        error = error || err;
        if (--wait === 0) {
            callback(error);
        }
    }
};

Neo4j.prototype.count = function count(model, callback, conds) {
    this.all(model, {where: conds}, function (err, collection) {
        callback(err, collection ? collection.length : 0);
    });
};

Neo4j.prototype.updateAttributes = function updateAttributes(model, id, data, cb) {
    data.id = id;
    this.node(id, function (err, node) {
        this.save(model, merge(node.data, data), cb);
    }.bind(this));
};

function cleanup(data) {
    if (!data) return null;
    
    var res = {};
    Object.keys(data).forEach(function (key) {
        var v = data[key];
        if (v === null) {
            // skip
            // console.log('skip null', key);
        } else if (v && v.constructor.name === 'Array' && v.length === 0) {
            // skip
            // console.log('skip blank array', key);
        } else if (typeof v !== 'undefined') {
            res[key] = v;
        }
    });
    return res;
}

function merge(base, update) {
    Object.keys(update).forEach(function (key) {
        base[key] = update[key];
    });
    return base;
}
