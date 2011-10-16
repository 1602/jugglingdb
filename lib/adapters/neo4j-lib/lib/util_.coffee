constants = require 'constants'

#-----------------------------------------------------------------------------
#
#  Errors
#
#-----------------------------------------------------------------------------

exports.adjustError = (error) ->
    # Neo4j server error (error is a response object)
    if error.statusCode >= 400 and error.body
        serverError = error.body

        # in some cases, node-request hasn't parsed response JSON yet, so do.
        # XXX protect against neo4j incorrectly sending HTML instead of JSON.
        if typeof serverError is 'string'
            try
                serverError = JSON.parse serverError

        error = new Error
        error.message = serverError.message or serverError

    if typeof error isnt 'object'
        error = new Error error

    if error.errno is constants.ECONNREFUSED
        error.message = "Couldn’t reach database (Connection refused)"

    return error

#-----------------------------------------------------------------------------
#
#  Serialization / Deserialization
#
#-----------------------------------------------------------------------------

exports.serialize = (o, separator) ->
    JSON.stringify flatten(o, separator)


exports.deserialize = (o, separator) ->
    unflatten JSON.parse(o), separator


flatten = (o, separator, result, prefix) ->
    separator = separator || '.'
    result = result || {}
    prefix = prefix || ''

    # only proceed if argument o is a complex object
    if typeof o isnt 'object'
        return o

    for key in Object.keys o
        value = o[key]
        if typeof value != 'object'
            result[prefix + key] = value
        else
            flatten(value, separator, result, key + separator)

    return result


unflatten = (o, separator, result) ->
    separator = separator || '.'
    result = result || {}

    # only proceed if argument o is a complex object
    if typeof o isnt 'object'
        return o

    for key in Object.keys o
        value = o[key]
        separatorIndex = key.indexOf separator
        if separatorIndex == -1
            result[key] = value
        else
            keys = key.split separator
            target = result
            numKeys = keys.length
            for i in [0..(numKeys - 2)]
                currentKey = keys[i]
                if target[currentKey] == undefined
                    target[currentKey] = {}
                target = target[currentKey]
            lastKey = keys[numKeys - 1]
            target[lastKey] = value

    return result
