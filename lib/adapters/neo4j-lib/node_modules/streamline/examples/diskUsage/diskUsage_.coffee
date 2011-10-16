#
# Usage: coffee-streamline diskUsage_.coffee [path]
#
# Recursively computes the size of directories.
# 
# Demonstrates how standard asynchronous node.js functions 
# like fs.stat, fs.readdir, fs.readFile can be called from 'streamlined'
# Javascript code.  
#

fs = require 'fs'

du = (_, path) ->
	total = 0
	stat = fs.stat path, _
	if stat.isFile()
		total += fs.readFile(path, _).length
	else if stat.isDirectory()
		files = fs.readdir path, _
		for f in files
			total += du _, path + "/" + f
		console.log path + ": " + total
	else
		console.log path + ": odd file"
	total

p = if process.argv.length > 2 then process.argv[2] else "."

t0 = Date.now()

try
	result = du _, p
	console.log "completed in " + (Date.now() - t0) + " ms"
catch err
	console.log err.toString() + "\n" + err.stack
