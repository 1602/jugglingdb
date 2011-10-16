// diskUsage2_coffee.js
// Wrapper for diskUsage2_.coffee that tests Streamline's require() of
// CoffeeScript files.
//
// Usage:
// node diskUsage2_coffee.js [path]

require('coffee-script');
require('streamline');

require('./diskUsage2_.coffee');
