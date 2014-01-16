/**
 * Module exports class Model
 */
module.exports = QueryChainer;

/**
 * QueryChainer class
 * Chaining many methods and have one callback
 * function for all methods.
 *
 * @constructor
 */
function QueryChainer() {
	this.operations = [];
	this.finished = 0;
	this.terminated = false;
	this.running = false;
	this.total = 0;
	this.errors = [];
}

/**
 * Add a method to chain
 *
 * @param {Object} klass - a juggligdb model class
 * @param {String} method - metohd to use
 * @param {Object} args - args to use for this method
 * @param {Function} callback - callback to use for this method
 */
QueryChainer.prototype.add = function(klass, method, args, callback) {
	if(arguments.length < 2) return this;
	this.operations.push ({klass: klass, method: method, args: args, callback: callback});
	this.total++;
	return this;
}

/**
 * Run the chainnig methods
 *
 * @param {Function} callback - callback to use when all the method are ended
 */
QueryChainer.prototype.run = function (callback) {
	var self = this;
	self.terminated = 0;
	self.running = true;
	if (self.operations.length == 0) return callback (null);
	for (var i = 0; i < self.operations.length; i++) {
		var operation = self.operations[i];
		try {
			var cb = (function(innercb) {
				return function(err, res) {
					if(innercb) innercb(err, res);
					self.terminated++;
					if (err) {
						if(err instanceof Array) for (var e in err) self.errors.push(err[e]);
						else self.errors.push(err);
					}
					if (self.terminated == self.total) {
						self.running = false;
						self.terminated = true;
						callback(!self.errors.length ? null : self.errors)
					}
				} 
			})(operation.callback);
			if (operation.args) operation.klass[operation.method](operation.args, cb);
			else operation.klass[operation.method](cb);
		} catch (err) {
			self.operations.splice(i, 1);
			i--;
			self.total--;
		}
	}
}