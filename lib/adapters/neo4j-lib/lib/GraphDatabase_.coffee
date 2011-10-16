# TODO many of these functions take a callback but, in some cases, call the
# callback immediately (e.g. if a value is cached). we should probably make
# sure to always call callbacks asynchronously, to prevent race conditions.
# this can be done in Streamline syntax by adding one line before cases where
# we're returning immediately: process.nextTick _

status = require 'http-status'
request = require 'request'

applyPatch = (method, auth) ->
    return if applyPatch.patched[method]
    applyPatch.patched[method] = true
    __m = request[method]
    request[method] = ->
        args = [].slice.call(arguments)
        url = args[0]
        # console.log(args)
        if typeof url == 'string' && !url.match(/https?:\/\/[^\/]*@/)
            args[0] = url.replace(/http:\/\//, 'http://' + auth + '@')
        # normalize opts
        if url && url.url
            url.uri = url.url
            delete url.url
        # handle auth in uri
        if url && url.uri && url.uri.match && !url.uri.match(/https?:\/\/[^\/]*@/)
            args[0].uri = url.uri.replace(/http:\/\//, 'http://' + auth + '@')
        __m.apply(request, args)

applyPatch.patched = {}

util = require './util_'
adjustError = util.adjustError

Relationship = require './Relationship_'
Node = require './Node_'

module.exports = class GraphDatabase
    constructor: (url) ->

        @url = url
        @auth = require('url').parse(url).auth

        applyPatch('get', @auth)
        applyPatch('post', @auth)
        applyPatch('put', @auth)
        applyPatch('del', @auth)
        applyPatch('head', @auth)

        # Cache
        @_root = null
        @_services = null

    # Database
    _purgeCache: ->
        @_root = null
        @_services = null

    _getRoot: (_) ->
        if @_root?
            return @_root

        try
            response = request.get @url, _

            if response.statusCode isnt status.OK
                throw response

            @_root = JSON.parse response.body
            return @_root

        catch error
            throw adjustError error

    getServices: (_) ->
        if @_services?
            return @_services

        try
            root = @_getRoot _
            response = request.get root.data, _

            if response.statusCode isnt status.OK
                throw response

            @_services = JSON.parse response.body
            return @_services

        catch error
            throw adjustError error

    # Nodes
    createNode: (data) ->
        data = data || {}
        node = new Node this,
            data: data
        return node

    getNode: (url, _) ->
        try
            response = request.get url, _

            if response.statusCode isnt status.OK

                # Node not found
                if response.statusCode is status.NOT_FOUND
                    throw new Error "No node at #{url}"

                throw response

            node = new Node this, JSON.parse response.body
            return node

        catch error
            throw adjustError error

    getIndexedNode: (index, property, value, _) ->
        try
            nodes = @getIndexedNodes index, property, value, _

            node = null
            if nodes and nodes.length > 0
                node = nodes[0]
            return node

        catch error
            throw adjustError error

    getIndexedNodes: (index, property, value, _) ->
        try
            services = @getServices _

            key = encodeURIComponent property
            val = encodeURIComponent value
            url = "#{services.node_index}/#{index}/#{key}/#{val}"

            response = request.get url, _

            if response.statusCode isnt status.OK
                # Database error
                throw response

            # Success
            nodeArray = JSON.parse response.body
            nodes = nodeArray.map (node) =>
                new Node this, node
            return nodes

        catch error
            throw adjustError error

    getNodeById: (id, _) ->
        try
            services = @getServices _
            url = "#{services.node}/#{id}"
            node = @getNode url, _
            return node

        catch error
            throw adjustError error

    # Relationships
    createRelationship: (startNode, endNode, type, _) ->
        # TODO: Implement

    getRelationship: (url, _) ->
        try
            response = request.get url, _

            if response.statusCode isnt status.OK
                # TODO: Handle 404
                throw response

            data = JSON.parse response.body

            # Construct relationship
            relationship = new Relationship this, data

            return relationship

        catch error
            throw adjustError error

    getRelationshipById: (id, _) ->
        services = @getServices _
        # FIXME: Neo4j doesn't expose the path to relationships
        relationshipURL = services.node.replace('node', 'relationship')
        url = "#{relationshipURL}/#{id}"
        @getRelationship url, _

    # wrapper around the Cypher plugin, which comes bundled w/ Neo4j.
    # pass in the Cypher query as a string (can be multi-line).
    # http://docs.neo4j.org/chunked/stable/cypher-query-lang.html
    # returns an array of "rows" (matches), where each row is a map from
    # variable name (as given in the passed in query) to value. any values
    # that represent nodes or relationships are transformed to instances.
    query: (_, query) ->
        try
            services = @getServices _
            endpoint = services.extensions?.CypherPlugin?['execute_query']
            if not endpoint
                throw new Error 'Cypher plugin not installed'

            response = request.post
                uri: endpoint
                json: {query}
            , _

            if response.statusCode isnt status.OK
                # Database error
                throw response

            # Success: build result maps, and transform nodes/relationships
            body = response.body    # JSON already parsed by request
            columns = body.columns
            results = for row in body.data
                map = {}
                for value, i in row
                    map[columns[i]] =
                        if value and typeof value is 'object' and value.self
                            if value.type then new Relationship this, value
                            else new Node this, value
                        else
                            value
                map
            return results

        catch error
            throw adjustError error

    # executes a query against the given node index. lucene syntax reference:
    # http://lucene.apache.org/java/3_1_0/queryparsersyntax.html
    queryNodeIndex: (index, query, _) ->
        try
            services = @getServices _
            url = "#{services.node_index}/#{index}?query=#{encodeURIComponent query}"

            response = request.get url, _

            if response.statusCode isnt status.OK
                # Database error
                throw response

            # Success
            nodeArray = JSON.parse response.body
            nodes = nodeArray.map (node) =>
                new Node this, node
            return nodes

        catch error
            throw adjustError error
