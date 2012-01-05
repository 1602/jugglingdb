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
  console.log(sql)
    var time = Date.now();
    var log = this.log;
    this.client.query(sql, function (err, data) {
        log(sql, time);
        callback(err, data);
    });
};

PG.prototype.save = function (model, data, callback) {
    var sql = 'UPDATE "' + model + '" SET ' + this.toFields(model, data) +
        ' WHERE "id" = ' + data.id;

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
            fields.push('"' + key + '" = ' + this.toDatabase(props[key], data[key]));
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
    var sql = 'SELECT 1 FROM "' + model + '" WHERE "id" = ' + id + ' LIMIT 1';
    this.query(sql, function (err, data) {
        if (err) return callback(err);
        callback(null, data.length === 1);
    });
};

PG.prototype.find = function find(model, id, callback) {
    var sql = 'SELECT * FROM "' + model + '" WHERE "id" = ' + id + ' LIMIT 1';
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
    var sql = 'DELETE FROM "' + model + '" WHERE "id" = ' + id + ' LIMIT 1';
    this.query(sql, function (err) {
        callback(err);
    });
};

// TODO: hook up where, order, limit and offset conditions
PG.prototype.all = function all(model, filter, callback) {
    this.query('SELECT * FROM "' + model + '"', function (err, data) {
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
    this.query('DELETE FROM "' + model + '"', function (err) {
        if (err) {
            return callback(err, []);
        }
        callback(err);
    }.bind(this));
};

PG.prototype.count = function count(model, callback) {
    this.query('SELECT count(*) as cnt FROM "' + model + '"', function (err, res) {
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

PG.prototype.automigrate = function (cb) {
    var self = this;
    var wait = 0;
    Object.keys(this._models).forEach(function (model) {
        wait += 1;
        self.dropTable(model, function () {
            self.createTable(model, function (err) {
                if (err) console.log(err);
                done();
            });
        });
    });

    function done() {
        if (--wait === 0 && cb) {
            cb();
        }
    }
};

PG.prototype.autoupdate = function (cb) {
    var self = this;
    var wait = 0;
    Object.keys(this._models).forEach(function (model) {
        wait += 1;
        self.query('SELECT column_name as Field, udt_name as Type, is_nullable as Null, column_default as Default FROM information_schema.COLUMNS WHERE table_name = \''+model+'\'', function (err, fields) {
            self.alterTable(model, fields, done);
        });
    });

    function done(err) {
        if (err) {
            console.log(err);
        }
        if (--wait === 0 && cb) {
            cb();
        }
    }
};

PG.prototype.alterTable = function (model, actualFields, done) {
    var self = this;
    var m = this._models[model];
    var propNames = Object.keys(m.properties);
    var sql = [];

    // change/add new fields
    propNames.forEach(function (propName) {
        var found;
        actualFields.forEach(function (f) {
            if (f.Field === propName) {
                found = f;
            }
        });

        if (found) {
            actualize(propName, found);
        } else {
            sql.push('ADD COLUMN "' + propName + '" ' + self.propertySettingsSQL(model, propName));
        }
    });

    // drop columns
    actualFields.forEach(function (f) {
        var notFound = !~propNames.indexOf(f.Field);
        if (f.Field === 'id') return;
        if (notFound || !m.properties[f.Field]) {
            sql.push('DROP COLUMN "' + f.Field + '"');
        }
    });

    if (sql.length) {
        this.query('ALTER TABLE "' + model + '" ' + sql.join(',\n'), done);
    } else {
        done();
    }

    function actualize(propName, oldSettings) {
        var newSettings = m.properties[propName];
        if (newSettings && changed(newSettings, oldSettings)) {
            sql.push('CHANGE COLUMN "' + propName + '" "' + propName + '" ' + self.propertySettingsSQL(model, propName));
        }
    }

    function changed(newSettings, oldSettings) {
        if (oldSettings.Null === 'YES' && (newSettings.allowNull === false || newSettings.null === false)) return true;
        if (oldSettings.Null === 'NO' && !(newSettings.allowNull === false || newSettings.null === false)) return true;
        if (oldSettings.Type.toUpperCase() !== datatype(newSettings)) return true;
        return false;
    }
};

PG.prototype.dropTable = function (model, cb) {
    this.query('DROP TABLE IF EXISTS ' + model, cb);
};

PG.prototype.createTable = function (model, cb) {
    this.query('CREATE TABLE "' + model +
        '" (\n  ' + this.propertiesSQL(model) + '\n)', cb);
};

PG.prototype.propertiesSQL = function (model) {
    var self = this;
    var sql = ['"id" SERIAL NOT NULL UNIQUE PRIMARY KEY'];
    Object.keys(this._models[model].properties).forEach(function (prop) {
        sql.push('"' + prop + '" ' + self.propertySettingsSQL(model, prop));
    });
    return sql.join(',\n  ');

};

PG.prototype.propertySettingsSQL = function (model, prop) {
    var p = this._models[model].properties[prop];
    return datatype(p) + ' ' +
    (p.allowNull === false || p['null'] === false ? 'NOT NULL' : 'NULL');
};

function datatype(p) {
    switch (p.type.name) {
        case 'String':
        return 'VARCHAR(' + (p.limit || 255) + ')';
        case 'Text':
        return 'TEXT';
        case 'Number':
        return 'INTEGER';
        case 'Date':
        return 'TIMESTAMP';
        case 'Boolean':
        return 'BOOLEAN';
    }
}