var safeRequire = require('../utils').safeRequire;

/**
 * Module dependencies
 */
var pg = safeRequire('pg');
var Hash = require('hashish');

exports.initialize = function initializeSchema(schema, callback) {
    if (!pg) return;

    var Client = pg.Client;
    var s = schema.settings;
    schema.client = new Client(s.url ? s.url : {
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
      }else{
        console.error(err);
        throw err;
      }
    });
};

function PG(client) {
    this._models = {};
    this.client = client;
}

PG.prototype.define = function (descr) {
    if (!descr.settings) descr.settings = {};
    this._models[descr.model.modelName] = descr;
};

PG.prototype.query = function (sql, callback) {
    var time = Date.now();
    var log = this.log;
    this.client.query(sql, function (err, data) {
        log(sql, time);
        callback(err, data ? Hash(data.rows) : null);
    });
};

PG.prototype.table = function (model) {
    return this._models[model].settings.table || model;
};

PG.prototype.save = function (model, data, callback) {
    var sql = 'UPDATE "' + this.table(model) + '" SET ' + this.toFields(model, data) +
        ' WHERE "id" = ' + data.id;

    this.query(sql, function (err) {
        callback(err);
    });
};

/**
 * Must invoke callback(err, id)
 */
PG.prototype.create = function (model, data, callback) {
    var fields = this.toFields(model, data,true);
    var sql = 'INSERT INTO "' + this.table(model) + '"';
    if (fields) {
        sql += ' ' + fields;
    } else {
        sql += ' VALUES ()';
    }
    sql += ' RETURNING id';
    this.query(sql, function (err, info) {
        if (err) return callback(err);
        callback(err, info && info.items[0] && info.items[0].id);
    });
};

PG.prototype.toFields = function (model, data, forCreate) {
    var fields = [];
    var props = this._models[model].properties;
    
    if(forCreate){
      var columns = [];
      Object.keys(data).forEach(function (key) {
          if (props[key]) {
              columns.push('"' + key + '"');
              fields.push(this.toDatabase(props[key], data[key]));
          }
      }.bind(this));
      return '(' + columns.join(',') + ') VALUES ('+fields.join(',')+')';
    }else{
      Object.keys(data).forEach(function (key) {
          if (props[key]) {
              fields.push('"' + key + '" = ' + this.toDatabase(props[key], data[key]));
          }
      }.bind(this));
      return fields.join(',');
    }
};

function dateToPostgres(val) {
    return [
        val.getUTCFullYear(),
        fz(val.getUTCMonth() + 1),
        fz(val.getUTCDate())
    ].join('-') + ' ' + [
        fz(val.getUTCHours()),
        fz(val.getUTCMinutes()),
        fz(val.getUTCSeconds())
    ].join(':');

    function fz(v) {
        return v < 10 ? '0' + v : v;
    }
}

PG.prototype.toDatabase = function (prop, val) {
    if (val === null) return 'NULL';
    if (val.constructor.name === 'Object') {
        var operator = Object.keys(val)[0]
        val = val[operator];
        if (operator === 'between') {
            return this.toDatabase(prop, val[0]) + ' AND ' + this.toDatabase(prop, val[1]);
        }
    }
    if (prop.type.name === 'Number') return val;
    if (prop.type.name === 'Date') {
        if (!val) return 'NULL';
        if (!val.toUTCString) {
            val = new Date(val);
        }
        return escape(dateToPostgres(val));
    }
    return escape(val.toString());

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
    var sql = 'SELECT 1 FROM "' + this.table(model) + '" WHERE "id" = ' + id + ' LIMIT 1';
    this.query(sql, function (err, data) {
        if (err) return callback(err);
        callback(null, data.items.length === 1);
    });
};

PG.prototype.find = function find(model, id, callback) {
    var sql = 'SELECT * FROM "' + model + '" WHERE "id" = ' + id + ' LIMIT 1';
    this.query(sql, function (err, data) {
        if (data && data.items && data.items.length === 1) {
            data.items[0].id = id;
        } else {
            data = { items: [null] };
        }
        callback(err, this.fromDatabase(model, data.items[0]));
    }.bind(this));
};

PG.prototype.destroy = function destroy(model, id, callback) {
    var sql = 'DELETE FROM "' + this.table(model) + '" WHERE "id" = ' + id;
    this.query(sql, function (err) {
        callback(err);
    });
};

// TODO: hook up where, order, limit and offset conditions
PG.prototype.all = function all(model, filter, callback) {
    this.query('SELECT * FROM "' + this.table(model) + '"' + this.toFilter(model, filter), function (err, data) {
        if (err) {
            return callback(err, []);
        }
        callback(err, data.items);
    }.bind(this));
};

PG.prototype.toFilter = function (model, filter) {
    if (filter && typeof filter.where === 'function') {
      return filter();
    }
    if (!filter) return '';
    var props = this._models[model].properties;
    var out = '';
    if (filter.where) {
        var fields = [];
        var conds = filter.where;
        Object.keys(conds).forEach(function (key) {
            if (filter.where[key] && filter.where[key].constructor.name === 'RegExp') {
                return;
            }
            if (props[key]) {
                var filterValue = this.toDatabase(props[key], filter.where[key]);
                if (filterValue === 'NULL') {
                    fields.push('"' + key + '" IS ' + filterValue);
                } else if (conds[key].constructor.name === 'Object') {
                    var condType = Object.keys(conds[key])[0];
                    var sqlCond = key;
                    switch (condType) {
                        case 'gt':
                        sqlCond += ' > ';
                        break;
                        case 'gte':
                        sqlCond += ' >= ';
                        break;
                        case 'lt':
                        sqlCond += ' < ';
                        break;
                        case 'lte':
                        sqlCond += ' <= ';
                        break;
                        case 'between':
                        sqlCond += ' BETWEEN ';
                        break;
                    }
                    sqlCond += filterValue;
                    fields.push(sqlCond);
                } else {
                    fields.push('"' + key + '" = ' + filterValue);
                }
            }
        }.bind(this));
        if (fields.length) {
            out += ' WHERE ' + fields.join(' AND ');
        }
    }

    if (filter.order) {
        out += ' ORDER BY ' + filter.order;
    }

    if (filter.limit) {
        out += ' LIMIT ' + filter.limit + ' ' + (filter.offset || '');
    }

    return out;
};

PG.prototype.destroyAll = function destroyAll(model, callback) {
    this.query('DELETE FROM "' + this.table(model) + '"', function (err) {
        if (err) {
            return callback(err, []);
        }
        callback(err);
    }.bind(this));
};

PG.prototype.count = function count(model, callback, where) {
    var self = this;
    var props = this._models[model].properties;

    this.query('SELECT count(*) as cnt FROM "' + this.table(model) + '"' + buildWhere(where), function (err, res) {
        if (err) return callback(err);
        callback(err, res && res.items[0] && res.items[0].cnt);
    });

    function buildWhere(conds) {
        var cs = [];
        Object.keys(conds || {}).forEach(function (key) {
            if (conds[key] === null) {
                cs.push(key + ' IS NULL');
            } else {
                cs.push(key + ' = ' + self.toDatabase(props[key], conds[key]));
            }
        });
        return cs.length ? ' WHERE ' + cs.join(' AND ') : '';
    }
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
        self.query('SELECT column_name as Field, udt_name as Type, is_nullable as Null, column_default as Default FROM information_schema.COLUMNS WHERE table_name = \''+this.table(model)+'\'', function (err, fields) {
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
        this.query('ALTER TABLE "' + this.table(model) + '" ' + sql.join(',\n'), done);
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
    this.query('DROP TABLE IF EXISTS "' + this.table(model) + '"', cb);
};

PG.prototype.createTable = function (model, cb) {
    this.query('CREATE TABLE "' + this.table(model) +
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

function escape(val) {
  if (val === undefined || val === null) {
    return 'NULL';
  }

  switch (typeof val) {
    case 'boolean': return (val) ? 'true' : 'false';
    case 'number': return val+'';
  }

  if (typeof val === 'object') {
    val = (typeof val.toISOString === 'function')
      ? val.toISOString()
      : val.toString();
  }

  val = val.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function(s) {
    switch(s) {
      case "\0": return "\\0";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\b": return "\\b";
      case "\t": return "\\t";
      case "\x1a": return "\\Z";
      default: return "\\"+s;
    }
  });
  return "'"+val+"'";
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
