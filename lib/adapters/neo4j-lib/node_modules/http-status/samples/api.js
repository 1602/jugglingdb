var HTTPStatus = require('http-status');

// Print "Internal Server Error"
console.log(HTTPStatus[500]);

// Print 500
console.log(HTTPStatus.INTERNAL_SERVER_ERROR);
