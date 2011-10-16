status = require 'http-status'
request = require 'request'

util = require './util_'
adjustError = util.adjustError

PropertyContainer = require './PropertyContainer_'
Relationship = require './Relationship_'
Path = require './Path_'

module.exports = class Node extends PropertyContainer
    constructor: (db, data) ->
        super db, data

    toString: ->
        "node @#{@id}"

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
                    # note that JSON has already been parsed by request.
                    message = response.body?.message
                    switch response.statusCode
                        when status.BAD_REQUEST then message or= 'Invalid data sent'
                        when status.NOT_FOUND then message or= 'Node not found'
                    throw new Error message
            else
                services = @db.getServices _

                response = request.post
                    uri: services.node
                    json: @data
                , _

                if response.statusCode isnt status.CREATED
                    # database error
                    # note that JSON has already been parsed by request.
                    message = response.body?.message or 'Invalid data sent'
                    throw new Error message

                # only update our copy of the data when it is POSTed.
                # note that JSON has already been parsed by request.
                @_data = response.body

            # explicitly not returning any value; making this a "void" method.
            return

        catch error
            throw adjustError error

    # throws an error if this node has any relationships on it, unless force
    # is true, in which case the relationships are also deleted.
    delete: (_, force=false) ->
        if not @exists
            return

        try
            # Does this node have any relationships on it?
            relationships = @all null, _

            # If so, and it's not expected, prevent mistakes!
            if relationships.length and not force
                throw new Error "Could not delete #{@}; still has relationships."

            # Otherwise, if there are any, delete the relationships
            # TODO parallelize using Streamline
            for relationship in relationships
                relationship.delete _

        catch error
            throw adjustError error

        # *Then* delete the node
        # XXX need to explicitly relay arguments to super since streamline
        # needs to see the underscore parameter currently.
        super _

    # Alias
    del: @::delete

    createRelationshipTo: (otherNode, type, data, _) ->
        @_createRelationship this, otherNode, type, data, _

    createRelationshipFrom: (otherNode, type, data, _) ->
        @_createRelationship otherNode, this, type, data, _

    _createRelationship: (from, to, type, data, _) ->
        try
            # ensure this node exists
            # ensure otherNode exists
            # create relationship

            # XXX Can we really always assume `from` is loaded?
            createRelationshipURL = from._data['create_relationship']
            otherNodeURL = to.self

            if createRelationshipURL? and otherNodeURL
                response = request.post
                    url: createRelationshipURL
                    json:
                        to: otherNodeURL
                        data: data
                        type: type
                , _

                if response.statusCode isnt status.CREATED
                    # database error
                    message = ''
                    switch response.statusCode
                        when status.BAD_REQUEST
                            # note that JSON has already been parsed by request.
                            message = response.body?.message or
                                      response.body?.exception or
                                      "Invalid createRelationship: #{from.id} #{type} #{to.id} w/ data: #{JSON.stringify data}"
                        when status.CONFLICT
                            message = '"to" node, or the node specified by the URI not found'
                    throw new Error message

                # success
                # note that JSON has already been parsed by request.
                relationship = new Relationship @db, response.body, from, to
                return relationship
            else
                throw new Error 'Failed to create relationship'

        catch error
            throw adjustError error

    # TODO support passing in no type, e.g. for all types?
    # TODO to be consistent with the REST and Java APIs, this returns an array
    # of all returned relationships. it would certainly be more user-friendly
    # though if it returned a dictionary of relationships mapped by type, no?
    # XXX TODO this takes direction and type as separate parameters, while the
    # getRelationshipNodes() method combines both as an object. inconsistent?
    # unfortunately, the REST API is also inconsistent like this...
    _getRelationships: (direction, type, _) ->
        # Method overload: No type specified
        # XXX can't support method overloading right now, because Streamline
        # doesn't allow "setting" the callback parameter like this requires.
        #if typeof type is 'function'
        #    _ = type
        #    type = []

        # Assume no types
        types = null

        # support passing in multiple types, as array
        if type?
            types = if type instanceof Array then type else [type]

        try
            if types?
                prefix = @_data["#{direction}_typed_relationships"]
                relationshipsURL = prefix?.replace '{-list|&|types}', types.join '&'
            else
                relationshipsURL = @_data["#{direction}_relationships"]

            if not relationshipsURL
                throw new Error 'Couldn\'t find URL of relationships endpoint.'

            resp = request.get relationshipsURL, _

            if resp.statusCode is status.NOT_FOUND
                throw new Error 'Node not found.'

            if resp.statusCode isnt status.OK
                throw new Error "Unrecognized response code: #{resp.statusCode}"

            # success
            data = JSON.parse resp.body
            relationships = data.map (data) =>
                # other node will automatically get filled in by Relationship
                if @self is data.start
                    new Relationship @db, data, this, null
                else
                    new Relationship @db, data, null, this
            return relationships

        catch error
            throw adjustError error

    # TODO to be consistent with the REST and Java APIs, this returns an array
    # of all returned relationships. it would certainly be more user-friendly
    # though if it returned a dictionary of relationships mapped by type, no?
    getRelationships: (type, _) ->
        @all type, _

    outgoing: (type, _) ->
        @_getRelationships 'outgoing', type, _

    incoming: (type, _) ->
        @_getRelationships 'incoming', type, _

    all: (type, _) ->
        @_getRelationships 'all', type, _

    path: (to, type, direction, maxDepth=1, algorithm='shortestPath', _) ->
        try
            pathURL = "#{@self}/path"
            data =
                to: to.self
                relationships:
                    type: type
                    direction: direction
                max_depth: maxDepth
                algorithm: algorithm

            res = request.post
                url: pathURL
                json: data
            , _

            if res.statusCode is status.NOT_FOUND
                # Empty path
                return null

            if res.statusCode isnt status.OK
                throw new Error "Unrecognized response code: #{res.statusCode}"

            # Parse result
            # Note that JSON has already been parsed by request.
            data = res.body

            start = new Node this, {self: data.start}
            end = new Node this, {self: data.end}
            length = data.length
            nodes = data.nodes.map (url) =>
                new Node this, {self: url}
            relationships = data.relationships.map (url) =>
                new Relationship this, {self: url, type}

            # Return path
            path = new Path start, end, length, nodes, relationships
            return path

        catch error
            throw adjustError error

    # XXX this is actually a traverse, but in lieu of defining a non-trivial
    # traverse() method, exposing this for now for our simple use case.
    # the rels parameter can be:
    # - just a string, e.g. 'has' (both directions traversed)
    # - an array of strings, e.g. 'has' and 'wants' (both directions traversed)
    # - just an object, e.g. {type: 'has', direction: 'out'}
    # - an array of objects, e.g. [{type: 'has', direction: 'out'}, ...]
    getRelationshipNodes: (rels, _) ->

        # support passing in both one rel and multiple rels, as array
        rels = if rels instanceof Array then rels else [rels]

        try
            traverseURL = @_data['traverse']?.replace '{returnType}', 'node'

            if not traverseURL
                throw new Error 'Traverse not available.'

            resp = request.post
                url: traverseURL
                json:
                    'max_depth': 1
                    'relationships': rels.map (rel) ->
                        if typeof rel is 'string' then {'type': rel} else rel
            , _

            if resp.statusCode is 404
                throw new Error 'Node not found.'

            if resp.statusCode isnt 200
                throw new Error "Unrecognized response code: #{resp.statusCode}"

            # success
            # note that JSON has already been parsed by request.
            return resp.body.map (data) => new Node @db, data

        catch error
            throw adjustError error

    index: (index, key, value, _) ->
        try
            # TODO
            if not @exists
                throw new Error 'Node must exists before indexing properties'

            services = @db.getServices _

            encodedKey = encodeURIComponent key
            encodedValue = encodeURIComponent value
            url = "#{services.node_index}/#{index}/#{encodedKey}/#{encodedValue}"

            response = request.post
                url: url
                json: @self
            , _

            if response.statusCode isnt status.CREATED
                # database error
                throw new Error response.statusCode

            # success
            return

        catch error
            throw adjustError error
