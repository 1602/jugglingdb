status = require 'http-status'
request = require 'request'

util = require './util_'
adjustError = util.adjustError

PropertyContainer = require './PropertyContainer_'

module.exports = class Relationship extends PropertyContainer
    constructor: (db, data, start, end) ->
        super db, data

        # require Node inline to prevent circular require dependency:
        Node = require './Node_'

        # TODO relationship "start" and "end" are inconsistent with
        # creating relationships "to" and "from". consider renaming.
        @_start = start or new Node db, {self: data.start}
        @_end = end or new Node db, {self: data.end}

        @getter 'start', -> @_start or null
        @getter 'end', -> @_end or null
        @getter 'type', -> data.type

    save: (_) ->
        try
            # TODO: check for actual modification
            if @exists
                response = request.put
                    uri: "#{@self}/properties"
                    json: @data
                , _

                if response.statusCode isnt status.NO_CONTENT
                    # database error
                    message = ''
                    switch response.statusCode
                        when status.BAD_REQUEST
                            message = 'Invalid data sent'
                        when status.NOT_FOUND
                            message = 'Relationship not found'
                    throw new Error message

                # explicitly returning nothing to make this a "void" method.
                return

        catch error
            throw adjustError error

    # Alias
    del: @::delete

