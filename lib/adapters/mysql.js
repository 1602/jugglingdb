/**
 * Module dependencies
 */
var mysql = require('mysql');

exports.initialize = function initializeSchema(schema, callback) {
    var s = schema.settings;
    schema.client = mysql.createClient({
        host: s.host || 'localhost',
        port: s.port || 3306,
        user: s.user,
        password: s.password,
        database: s.database,
        debug: s.debug
    });

    schema.client.auth(schema.settings.password, callback);

    schema.adapter = new MySQL(schema.client);
};

function MySQL(client) {
    this._models = {};
    this.client = client;
}

MySQL.prototype.define = function (descr) {
    this._models[descr.model.modelName] = descr;
};

MySQL.prototype.save = function (model, data, callback) {
    this.client.query()
    this.client.hmset(model + ':' + data.id, data, callback);
};

MySQL.prototype.create = function (model, data, callback) {
    this.client.incr(model + ':id', function (err, id) {
        data.id = id;
        this.save(model, data, function (err) {
            if (callback) {
                callback(err, id);
            }
        });
    }.bind(this));
};

MySQL.prototype.exists = function (model, id, callback) {
    this.client.exists(model + ':' + id, function (err, exists) {
        if (callback) {
            callback(err, exists);
        }
    });
};

MySQL.prototype.find = function find(model, id, callback) {
    this.client.hgetall(model + ':' + id, function (err, data) {
        if (data && data.id) {
            data.id = id;
        } else {
            data = null;
        }
        callback(err, data);
    });
};

MySQL.prototype.destroy = function destroy(model, id, callback) {
    this.client.del(model + ':' + id, function (err) {
        callback(err);
    });
};

MySQL.prototype.all = function all(model, filter, callback) {
    this.client.keys(model + ':*', function (err, keys) {
        if (err) {
            return callback(err, []);
        }
        var query = keys.map(function (key) {
            return ['hgetall', key];
        });
        this.client.multi(query).exec(function (err, replies) {
            callback(err, filter ? replies.filter(applyFilter(filter)) : replies);
        });
    }.bind(this));
};

function applyFilter(filter) {
    if (typeof filter === 'function') {
        return filter;
    }
    var keys = Object.keys(filter);
    return function (obj) {
        var pass = true;
        keys.forEach(function (key) {
            if (!test(filter[key], obj[key])) {
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

MySQL.prototype.destroyAll = function destroyAll(model, callback) {
    this.client.keys(model + ':*', function (err, keys) {
        if (err) {
            return callback(err, []);
        }
        var query = keys.map(function (key) {
            return ['del', key];
        });
        this.client.multi(query).exec(function (err, replies) {
            callback(err);
        });
    }.bind(this));
};

MySQL.prototype.count = function count(model, callback) {
    this.client.keys(model + ':*', function (err, keys) {
        callback(err, err ? null : keys.length);
    });
};

MySQL.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    this.client.hmset(model + ':' + id, data, cb);
};


