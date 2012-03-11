var safeRequire = require('../utils').safeRequire;

/**
 * Module dependencies
 */
var pg = safeRequire('pg');
var BaseSQL = require('../sql');

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

    schema.adapter.connect(callback);
};

function PG(client) {
    this._models = {};
    this.client = client;
}

require('util').inherits(PG, BaseSQL);

PG.prototype.connect = function (callback) {
    this.client.connect(function (err) {
        if (!err){
            callback();
        }else{
            console.error(err);
            throw err;
        }
    });
};

PG.prototype.query = function (sql, callback) {
    var time = Date.now();
    var log = this.log;
    this.client.query(sql, function (err, data) {
        log(sql, time);
        callback(err, data ? data.rows : null);
    });
};

/**
 * Must invoke callback(err, id)
 */
PG.prototype.create = function (model, data, callback) {
    var fields = this.toFields(model, data,true);
    var sql = 'INSERT INTO ' + this.tableEscaped(model) + '';
    if (fields) {
        sql += ' ' + fields;
    } else {
        sql += ' VALUES ()';
    }
    sql += ' RETURNING id';
    this.query(sql, function (err, info) {
        if (err) return callback(err);
        callback(err, info && info[0] && info[0].id);
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

PG.prototype.escapeName = function (name) {
    return '"' + name + '"';
};

PG.prototype.all = function all(model, filter, callback) {
    this.query('SELECT * FROM ' + this.tableEscaped(model) + ' ' + this.toFilter(model, filter), function (err, data) {
        if (err) {
            return callback(err, []);
        }
        callback(err, data);
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

PG.prototype.autoupdate = function (cb) {
    var self = this;
    var wait = 0;
    Object.keys(this._models).forEach(function (model) {
        wait += 1;
        self.query('SELECT column_name as Field, udt_name as Type, is_nullable as Null, column_default as Default FROM information_schema.COLUMNS WHERE table_name = \''+ this.table(model) + '\'', function (err, fields) {
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
        this.query('ALTER TABLE ' + this.tableEscaped(model) + ' ' + sql.join(',\n'), done);
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
