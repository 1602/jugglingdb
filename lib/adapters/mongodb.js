var safeRequire = require('../utils').safeRequire;

/**
 * Module dependencies
 */
var mongodb = safeRequire('mongodb');
var ObjectID = mongodb.ObjectID;

exports.initialize = function initializeSchema(schema, callback) {
    if (!mongodb) return;

    var s = schema.settings;

    if (schema.settings.url) {
        var url = require('url').parse(schema.settings.url);
        s.host = url.hostname;
        s.port = url.port;
        s.database = url.pathname.replace(/^\//, '');
        s.username = url.auth && url.auth.split(':')[0];
        s.password = url.auth && url.auth.split(':')[1];
    }

    s.host = s.host || 'localhost';
    s.port = parseInt(s.port || '27017', 10);
    s.database = s.database || 'test';

    schema.adapter = new MongoDB(s, schema, callback);
};

function MongoDB(s, schema, callback) {
    this._models = {};
    this.collections = {};

    var server = new mongodb.Server(s.host, s.port, {});
    new mongodb.Db(s.database, server, {}).open(function (err, client) {
        if (err) throw err;
        this.client = client;
        schema.client = client;
        callback();
    }.bind(this));
}

MongoDB.prototype.define = function (descr) {
    if (!descr.settings) descr.settings = {};
    this._models[descr.model.modelName] = descr;
};

MongoDB.prototype.defineProperty = function (model, prop, params) {
    this._models[model].properties[prop] = params;
};

MongoDB.prototype.collection = function (name) {
    if (!this.collections[name]) {
        this.collections[name] = new mongodb.Collection(this.client, name);
    }
    return this.collections[name];
};

MongoDB.prototype.create = function (model, data, callback) {
    this.collection(model).insert(data, {}, function (err, m) {
        callback(err, err ? null : m[0]._id.toString());
    });
};

MongoDB.prototype.save = function (model, data, callback) {
    this.collection(model).save({_id: new ObjectID(data.id)}, data, function (err) {
        callback(err);
    });
};

MongoDB.prototype.exists = function (model, id, callback) {
    this.collection(model).findOne({_id: new ObjectID(id)}, function (err, data) {
        callback(err, !err && data);
    });
};

MongoDB.prototype.find = function find(model, id, callback) {
    this.collection(model).findOne({_id: new ObjectID(id)}, function (err, data) {
        if (data) data.id = id;
        callback(err, data);
    });
};

MongoDB.prototype.destroy = function destroy(model, id, callback) {
    this.collection(model).remove({_id: new ObjectID(id)}, callback);
};

MongoDB.prototype.all = function all(model, filter, callback) {
    if (!filter) {
        filter = {};
    }
    var query = {};
    if (filter.where) {
        Object.keys(filter.where).forEach(function (k) {
            var cond = filter.where[k];
            var spec = false;
            if (cond && cond.constructor.name === 'Object') {
                spec = Object.keys(cond)[0];
                cond = cond[spec];
            }
            if (spec) {
                if (spec === 'between') {
                    query[k] = { $gte: cond[0], $lte: cond[1]};
                } else {
                    query[k] = {};
                    query[k]['$' + spec] = cond;
                }
            } else {
                if (cond === null) {
                    query[k] = {$type: 10};
                } else {
                    query[k] = cond;
                }
            }
        });
    }
    var cursor = this.collection(model).find(query);

    if (filter.order) {
        var m = filter.order.match(/\s+(A|DE)SC$/);
        var key = filter.order;
        var reverse = false;
        if (m) {
            key = key.replace(/\s+(A|DE)SC$/, '');
            if (m[1] === 'DE') reverse = true;
        }
        if (reverse) {
            cursor.sort([[key, 'desc']]);
        } else {
            cursor.sort(key);
        }
    }
    if (filter.limit) {
        cursor.limit(filter.limit);
    }
    if (filter.skip) {
        cursor.skip(filter.skip);
    } else if (filter.offset) {
        cursor.skip(filter.offset);
    }
    cursor.toArray(function (err, data) {
        if (err) return callback(err);
        callback(null, data.map(function (o) { o.id = o._id.toString(); delete o._id; return o; }));
    });
};

MongoDB.prototype.destroyAll = function destroyAll(model, callback) {
    this.collection(model).remove({}, callback);
};

MongoDB.prototype.count = function count(model, callback, where) {
    this.collection(model).count(where, function (err, count) {
        callback(err, count);
    });
};

MongoDB.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    this.collection(model).findAndModify({_id: new ObjectID(id)}, [['_id','asc']], {$set: data}, {}, function(err, object) {
        cb(err, object);
    });
};

MongoDB.prototype.disconnect = function () {
    this.client.close();
};

