{_} = require 'lodash'

# api
exports.initialize = (schema, callback) ->
  throw new Error 'url is missing' unless opts = schema.settings
  db = require('nano')(opts)

  schema.adapter = new NanoAdapter db
  design = views: by_model: map:
    'function (doc) { if (doc.model) return emit(doc.model, null); }'
  db.insert design, '_design/nano', (err, doc) -> callback()

class NanoAdapter
  constructor: (@db) ->
    @_models = {}

  define: (descr) =>
    m = descr.model.modelName
    descr.properties._rev = type: String
    @_models[m] = descr

  create: (args...) => @save args...
  
  save: (model, data, callback) =>
    data.model = model
    helpers.savePrep data

    @db.insert @forDB(model, data), (err, doc) =>
      callback err, doc.id, doc.rev

  updateOrCreate: (model, data, callback) =>
    @exists model, data.id, (err, exists) =>
      if exists
        @save model, data, callback
      else
        @create model, data, (err, id) ->
          data.id = id
          callback err, data
  
  exists: (model, id, callback) =>
    @db.head id, (err, _, headers) ->
      return callback null, no if err
      callback null, headers?

  find: (model, id, callback) =>
    @db.get id, (err, doc) =>
      callback err, @fromDB(model, doc)

  destroy: (model, id, callback) =>
    @db.get id, (err, doc) =>
      return callback err if err
      @db.destroy id, doc._rev, (err, doc) =>
        return callback err if err
        callback.removed = yes
        callback()
  
  updateAttributes: (model, id, data, callback) =>
    @db.get id, (err, base) =>
      return callback err if err
      @save model, helpers.merge(base, data), callback
  
  count: (model, callback, where) =>
    @all model, {where}, (err, docs) =>
      callback err, docs.length

  destroyAll: (model, callback) =>
    @all model, {}, (err, docs) =>
      docs = for doc in docs
        {_id: doc.id, _rev: doc._rev, _deleted: yes}
      @db.bulk {docs}, (err, body) =>
        callback err, body

  forDB: (model, data = {}) =>
    props = @_models[model].properties
    for k, v of props
      if data[k] and props[k].type.name is 'Date' and data[k].getTime?
        data[k] = data[k].getTime()
    data

  fromDB: (model, data) =>
    return data unless data
    props = @_models[model].properties
    for k, v of props
      if data[k]? and props[k].type.name is 'Date'
        date = new Date data[k]
        date.setTime data[k]
        data[k] = date
    data
    
  all: (model, filter, callback) =>
    params = 
      keys: [model]
      include_docs: yes

    @db.view 'nano', 'by_model', params, (err, body) =>
      docs = for row in body.rows
        row.doc.id = row.doc._id
        delete row.doc._id
        row.doc
      
      if where = filter?.where
        for k, v of where
          where[k] = v.getTime() if _.isDate v
        docs = _.where docs, where

      if orders = filter?.order
        orders = [orders] if _.isString orders
        
        sorting = (a, b) ->
          for item, i in @
            ak = a[@[i].key]; bk = b[@[i].key]; rev = @[i].reverse
            if ak > bk then return 1 * rev
            if ak < bk then return -1 * rev
          0

        for key, i in orders
          orders[i] =
            reverse: helpers.reverse key
            key: helpers.stripOrder key

        docs.sort sorting.bind orders
      callback err, (@fromDB model, doc for doc in docs)

# helpers
helpers =
  merge: (base, update) ->
    return update unless base
    base[k] = update[k] for k, v of update
    base
  reverse: (key) ->
    if hasOrder = key.match(/\s+(A|DE)SC$/i)
      return -1 if hasOrder[1] is "DE"
    1
  stripOrder: (key) ->
    key.replace(/\s+(A|DE)SC/i, "")
  savePrep: (data) ->
    if id = data.id
      delete data.id
      data._id = id.toString()
    if data._rev is null
      delete data._rev
