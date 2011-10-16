module.exports = class Path
    constructor: (start, end, length, nodes, relationships) ->
        @_start = start
        @_nodes = nodes
        @_length = length
        @_relationships = relationships
        @_end = end

        @getter 'start', -> @_start || null
        @getter 'end', -> @_end || null
        @getter 'length', -> @_length || 0
        @getter 'nodes', -> @_nodes || []
        @getter 'relationships', -> @_relationships || []

    getter: @__defineGetter__
    setter: @__defineSetter__
