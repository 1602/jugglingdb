/**
 * Module dependencies
 */
var Client = require('pg').Client;
exports.initialize = function initializeSchema(schema, callback) {
    var s = schema.settings;
    schema.client = new Client({
        host: s.host || 'localhost',
        port: s.port || 5432,
        user: s.username,
        password: s.password,
        database: s.database,
        debug: s.debug
    });
    schema.adapter = new PG(schema.client);
    schema.client.connect(function(err){
      if(!err){
        process.nextTick(callback);
      }
    });
};

function PG(client) {
    this._models = {};
    this.client = client;
}

PG.prototype.define = function (descr) {
    this._models[descr.model.modelName] = descr;
};

PG.prototype.query = function (sql, callback) {
    var time = Date.now();
    var log = this.log;
    this.client.query(sql, function (err, data) {
        log(sql, time);
        callback(err, data);
    });
};

PG.prototype.save = function (model, data, callback) {
    var sql = 'UPDATE ' + model + ' SET ' + this.toFields(model, data) +
        ' WHERE id = ' + data.id;

    this.query(sql, function (err) {
        callback(err);
    });
};

/**
 * Must invoke callback(err, id)
 */
PG.prototype.create = function (model, data, callback) {
    var fields = this.toFields(model, data);
    var sql = 'INSERT ' + model;
    if (fields) {
        sql += ' SET ' + fields;
    } else {
        sql += ' VALUES ()';
    }
    this.query(sql, function (err, info) {
        callback(err, info && info.insertId);
    });
};

PG.prototype.toFields = function (model, data) {
    var fields = [];
    var props = this._models[model].properties;
    Object.keys(data).forEach(function (key) {
        if (props[key]) {
            fields.push(key + ' = ' + this.toDatabase(props[key], data[key]));
        }
    }.bind(this));
    return fields.join(',');
};

PG.prototype.toDatabase = function (prop, val) {
    if (prop.type.name === 'Number') return val;
    if (val === null) return 'NULL';
    if (prop.type.name === 'Date') {
        if (!val) return 'NULL';
        if (!val.toUTCString) {
            val = new Date(val);
        }
        val = [
            val.getFullYear(),
            val.getMonth() + 1,
            val.getDate(),
            val.getHours(),
            val.getMinutes(),
            val.getSeconds()
        ].join('-');
        return this.client.escape(val);
    }
    return this.client.escape(val.toString());
};

PG.prototype.fromDatabase = function (model, data) {
    if (!data) return null;
    var props = this._models[model].properties;
    Object.keys(data).forEach(function (key) {
        var val = data[key];
        if (props[key]) {
            // if (props[key])
        }
        data[key] = val;
    });
    return data;
};

PG.prototype.exists = function (model, id, callback) {
    var sql = 'SELECT 1 FROM ' + model + ' WHERE id = ' + id + ' LIMIT 1';
    this.query(sql, function (err, data) {
        if (err) return callback(err);
        callback(null, data.length === 1);
    });
};

PG.prototype.find = function find(model, id, callback) {
    var sql = 'SELECT * FROM ' + model + ' WHERE id = ' + id + ' LIMIT 1';
    this.query(sql, function (err, data) {
        if (data && data.length === 1) {
            data[0].id = id;
        } else {
            data = [null];
        }
        callback(err, this.fromDatabase(model, data[0]));
    }.bind(this));
};

PG.prototype.destroy = function destroy(model, id, callback) {
    var sql = 'DELETE FROM ' + model + ' WHERE id = ' + id + ' LIMIT 1';
    this.query(sql, function (err) {
        callback(err);
    });
};

// TODO: hook up where, order, limit and offset conditions
PG.prototype.all = function all(model, filter, callback) {
    this.query('SELECT * FROM ' + model, function (err, data) {
        if (err) {
            return callback(err, []);
        }
        callback(err, filter ? data.filter(applyFilter(filter)) : data);
    }.bind(this));
};

function applyFilter(filter) {
    if (typeof filter.where === 'function') {
        return filter;
    }
    var keys = Object.keys(filter.where);
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
        // not strict equality
        return example == value;
    }
}

PG.prototype.destroyAll = function destroyAll(model, callback) {
    this.query('DELETE FROM ' + model, function (err) {
        if (err) {
            return callback(err, []);
        }
        callback(err);
    }.bind(this));
};

PG.prototype.count = function count(model, callback) {
    this.query('SELECT count(*) as cnt FROM ' + model, function (err, res) {
        callback(err, err ? null : res[0].cnt);
    });
};

PG.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    data.id = id;
    this.save(model, data, cb);
};

PG.prototype.disconnect = function disconnect() {
    this.client.end();
};

