/**
 * Module dependencies
 */
var neo4j = require('neo4j');

exports.initialize = function initializeSchema(schema, callback) {
    schema.client = new neo4j.GraphDatabase(schema.settings.url);
    schema.adapter = new Neo4j(schema.client);
};

function Neo4j(client) {
    this._models = {};
    this.client = client;
    this.cache = {};
}

Neo4j.prototype.define = function defineModel(descr) {
    this._models[descr.model.modelName] = descr;
};

Neo4j.prototype.node = function find(id, callback) {
    if (this.cache[id]) {
        callback(null, this.cache[id]);
    } else {
        this.client.getNodeById(id, function (err, node) {
            this.cache[id] = node;
            callback(err, node);
        }.bind(this));
    }
};

Neo4j.prototype.create = function create(model, data, callback) {
    data.nodeType = model;
    var node = this.client.createNode();
    node.data = cleanup(data);
    node.save(function (err) {
        if (err) {
            return callback && callback(err);
        }
        this.cache[node.id] = node;
        node.index(model, 'id', node.id, function (err) {
            callback && callback(err, node.id);
        });
    }.bind(this));
};

Neo4j.prototype.save = function save(model, data, callback) {
    this.node(data.id, function (err, node) {
        if (err) return callback(err);
        node.data = cleanup(data);
        node.save(callback);
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
    this.node(id, function (err, node) {
        if (err) return callback(err);
        node.delete(function (err) {
            if (err) return callback(err);
            delete this.cache[id];
        }.bind(this), true);
    });
};

Neo4j.prototype.all = function all(model, filter, callback) {
    this.client.queryNodeIndex(model, 'id:*', function (err, nodes) {
        callback(err, filter && nodes ? nodes.filter(applyFilter(filter)) : nodes);
    });
};

function applyFilter(filter) {
    if (typeof filter === 'function') {
        return filter;
    }
    var keys = Object.keys(filter);
    return function (obj) {
        var pass = true;
        keys.forEach(function (key) {
            if (!test(filter[key], obj.data[key])) {
                pass = false;
            }
        });
        return pass;
    }

    function test(example, value) {
        if (typeof value === 'string' && example && example.constructor.name === 'RegExp') {
            return value.match(example);
        }
        // not strict equality
        return example == value;
    }
}

Neo4j.prototype.destroyAll = function destroyAll(model, callback) {
    var wait, error = null;
    this.all(model, null, function (err, collection) {
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

Neo4j.prototype.count = function count(model, callback) {
    this.all(model, null, function (err, collection) {
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
    if (!data) return console.log('no data!') && {};
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
