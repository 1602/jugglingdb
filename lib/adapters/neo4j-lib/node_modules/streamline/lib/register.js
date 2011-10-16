console.error("Module moved to subdirectory. New require path is streamline/lib/compiler/register");
var moved = require("./compiler/register");
for (var name in moved)
	exports[name] = moved[name];

