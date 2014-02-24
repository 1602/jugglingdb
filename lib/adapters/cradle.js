var safeRequire = require('../utils').safeRequire;

/**
 * Module dependencies
 */
var cradle = safeRequire('cradle');

/**
 * Private functions for internal use
 */
function CradleAdapter(client) {
    this._models = {};
    this.client = client;
}

function createdbif(client, callback) {
    client.exists(function (err, exists) {
        if(err) callback(err);
        if (!exists) { client.create(function() { callback(); }); }
        else { callback(); }
    });
}

function naturalize(data, table) {
    data.nature = table;
    //TODO: maybe this is not a really good idea
    if(data.date) data.date = data.date.toString();
    return data;
}
function idealize(data) {
    data.id = data._id;
    return data;
}
function stringify(data) {
    return data ? data.toString() : data 
}

function errorHandler(callback, func) {
    return function(err, res) {
        if (err) {
            console.log('cradle', err);
            callback(err);
        } else {
            if(func) {
                func(res, function(res) {
                    callback(null, res);
                });
            } else {
                callback(null, res);
            }
        }
    }
};

function synchronize(functions, args, callback) {
    if(functions.length === 0) callback();
    if(functions.length > 0 && args.length === functions.length) {
        functions[0](args[0][0], args[0][1], function(err, res) {
            if(err) callback(err);
            functions.splice(0, 1);
            args.splice(0, 1);
            synchronize(functions, args, callback);
        });
    }
};

function applyFilter(filter) {
    if (typeof filter.where === 'function') {
        return filter.where;
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

function numerically(a, b) {
   return a[this[0]] - b[this[0]];
}

function literally(a, b) {
   return a[this[0]] > b[this[0]];
}

function filtering(res, model, filter, instance) {
   if (model) {
      if (filter == null) filter = {};
      if (filter.where == null) filter.where = {};
      // use table() function on fake instance
      filter.where.nature = CradleAdapter.prototype.table.call({_models: instance}, model);
   }
   // do we need some filtration?
   if (filter.where) {
      res = res ? res.filter(applyFilter(filter)) : res;
   }

   // do we need some sorting?
   if (filter.order) {
      var props = instance[model].properties;
      var allNumeric = true;
      var orders = filter.order;
      var reverse = false;
      if (typeof filter.order === "string") {
         orders = [filter.order];
      }

      orders.forEach(function (key, i) {
         var m = key.match(/\s+(A|DE)SC$/i);
         if (m) {
            key = key.replace(/\s+(A|DE)SC/i, '');
            if (m[1] === 'DE') reverse = true;
         }
         orders[i] = key;
         if (props[key].type.name !== 'Number') {
            allNumeric = false;
         }
      });
      if (allNumeric) {
         res = res.sort(numerically.bind(orders));
      } else {
         res = res.sort(literally.bind(orders));
      }
      if (reverse) res = res.reverse();
   }
   return res;
}

/**
 * Connection/Disconnection
 */
exports.initialize = function(schema, callback) {
    if (!cradle) return;

    // when using cradle if we dont wait for the schema to be connected, the models fails to load correctly.
    schema.waitForConnect = true;
    if (!schema.settings.url) {
        var host = schema.settings.host || 'localhost';
        var port = schema.settings.port || '5984';
        var options = schema.settings.options || {
           cache: true,
           raw: false
        };
        if (schema.settings.username) {
            options.auth = {};
            options.auth.username = schema.settings.username;
            if (schema.settings.password) {
                options.auth.password = schema.settings.password;
            }
        }
        var database = schema.settings.database || 'jugglingdb';

        schema.settings.host = host;
        schema.settings.port = port;
        schema.settings.database = database;
        schema.settings.options = options;
    }
    schema.client = new(cradle.Connection)(schema.settings.host, schema.settings.port,schema.settings.options).database(schema.settings.database);

    createdbif(
       schema.client,
       errorHandler(callback, function() {
          schema.adapter = new CradleAdapter(schema.client);
          process.nextTick(callback);
       }));
};

CradleAdapter.prototype.disconnect = function() {
};

/**
 * Write methods
 */
CradleAdapter.prototype.define = function(descr) {
    this._models[descr.model.modelName] = descr;
};

CradleAdapter.prototype.create = function(model, data, callback) {
    this.client.save(
       stringify(data.id),
       naturalize(data, this.table(model)),
       errorHandler(callback, function(res, cb) {
          cb(res.id);
       })
    );
};

CradleAdapter.prototype.save = function(model, data, callback) {
   this.client.save(
       stringify(data.id),
       naturalize(data, this.table(model)),
       errorHandler(callback)
   )
};

CradleAdapter.prototype.updateAttributes = function(model, id, data, callback) {
    this.client.merge(
       stringify(id),
       data,
       errorHandler(callback, function(doc, cb) {
          cb(idealize(doc));
       })
    );
};

CradleAdapter.prototype.updateOrCreate = function(model, data, callback) {
   this.client.get(
      stringify(data.id),
      function (err, doc) {
         if(err) {
            this.create(model, data, callback);
         } else {
            this.updateAttributes(model, data.id, data, callback);
         }
      }.bind(this)
   )
};

/**
 * Read methods
 */
CradleAdapter.prototype.exists = function(model, id, callback) {
    this.client.get(
       stringify(id), 
       errorHandler(callback, function(doc, cb) {
          cb(!!doc);   
       })
    );
};

CradleAdapter.prototype.find = function(model, id, callback) {
    this.client.get(
       stringify(id),
       errorHandler(callback, function(doc, cb) {
          cb(idealize(doc));
       })
    );
};

CradleAdapter.prototype.count = function(model, callback, where) {
    this.models(
       model,
       {where: where},
       callback,
       function(docs, cb) {
          cb(docs.length);
       }
    );
};

CradleAdapter.prototype.models = function(model, filter, callback, func) {
    var limit = 200;
    var skip  = 0;
    if (filter != null) {
        limit = filter.limit || limit;
        skip  = filter.skip ||skip;
    }

    var self = this;
    var table = this.table(model);

    self.client.save('_design/'+table, {
        views : {
            all : {
                map : 'function(doc) { if (doc.nature == "'+table+'") { emit(doc._id, doc); } }'
            }
        }
    }, function() {
        self.client.view(table+'/all', {include_docs:true, limit:limit, skip:skip}, errorHandler(callback, function(res, cb) {
            var docs = res.map(function(doc) {
                return idealize(doc);
            });
            var filtered = filtering(docs, model, filter, this._models)

            func ? func(filtered, cb) : cb(filtered);
        }.bind(self)));
    });
};

CradleAdapter.prototype.all = function(model, filter, callback) {
   this.models(
       model,
       filter,
       callback
   );
};

/**
 * Detroy methods
 */
CradleAdapter.prototype.destroy = function(model, id, callback) {
    this.client.remove(
       stringify(id),
       function (err, doc) {
         callback(err);
       }
    );
};

CradleAdapter.prototype.destroyAll = function(model, callback) {
   this.models(
       model,
       null,
       callback,
       function(docs, cb) {
          var docIds = docs.map(function(doc) {
             return doc.id;                     
          });
          this.client.get(docIds, function(err, res) {
             if(err) cb(err);

             var funcs = res.map(function(doc) {
                return this.client.remove.bind(this.client);
             }.bind(this));

             var args = res.map(function(doc) {
                return [doc._id, doc._rev];
             });

             synchronize(funcs, args, cb);
          }.bind(this));
       }.bind(this)
   );
};

CradleAdapter.prototype.table = function(model) {
    return this._models[model].model.tableName;
};
