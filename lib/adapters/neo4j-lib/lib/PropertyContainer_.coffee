status = require 'http-status'
request = require 'request'

util = require './util_'
adjustError = util.adjustError

module.exports = class PropertyContainer
    constructor: (db, data) ->
        @db = db

        @_data = data or {}
        @_data.self = data?.self or null

        @getter 'self', -> @_data.self or null
        @getter 'exists', -> @self?
        @getter 'id', ->
            if not @exists
                null
            else
                match = /(?:node|relationship)\/(\d+)$/.exec @self
                #/ XXX slash to unbreak broken coda coffee plugin (which chokes on the regex with a slash)
                parseInt match[1]

        @getter 'data', -> @_data.data or null
        @setter 'data', (value) -> @_data.data = value

    getter: @::__defineGetter__
    setter: @::__defineSetter__

    equals: (other) ->
        @self is other?.self

    delete: (_) ->
        if not @exists
            return

        try
            response = request.del @self, _

            if response.statusCode isnt status.NO_CONTENT
                # database error
                message = ''
                switch response.statusCode
                    when status.NOT_FOUND
                        message = 'PropertyContainer not found'
                    when status.CONFLICT
                        message = 'Node could not be deleted (still has relationships?)'
                throw new Error message

            # success
            @_data.self = null

            return

        catch error
            throw adjustError error
