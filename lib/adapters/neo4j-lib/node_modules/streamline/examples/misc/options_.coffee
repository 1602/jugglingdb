# options_.coffee
# An example of specifying file-level options in CoffeeScript.
#
# Usage:
# coffee-streamline options_.coffee
#
# streamline.options = { "callback": "_wait" }

_ = require 'underscore'
assert = require 'assert'

# simulate async step here:
setTimeout _wait, 2000;

# use underscore library here:
assert.ok _.isArray [1, 2, 3]

# if we got here, it worked!
console.log 'job well done.'
