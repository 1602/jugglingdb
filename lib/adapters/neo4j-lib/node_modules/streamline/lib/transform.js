console.error("Module moved to subdirectory. New require path is streamline/lib/compiler/transform");
var moved = require("./compiler/transform");
for (var name in moved)
	exports[name] = moved[name];

