// diskUsage_coffee.js
// Wrapper for diskUsage_.coffee that tests Streamline's require() of
// CoffeeScript files.
//
// Usage:
// node diskUsage_coffee.js [path]

require('coffee-script');
require('streamline');

require('./diskUsage_.coffee');
