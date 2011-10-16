# HTTP Status

Utility to interact with HTTP status code.

## Usage

### API sample

    var HTTPStatus = require('http-status');

    // Print "Internal Server Error"
    console.log(HTTPStatus[500]);

    // Print 500
    console.log(HTTPStatus.INTERNAL_SERVER_ERROR);

### Express sample

    var express = require('express'),
        redis = require('redis'),
        HTTPStatus = require('http-status');

    var app = express.createServer();

    app.get('/', function (req, res) {
        var client = redis.createClient();
        client.ping(function (err, msg) {
            if (err) {
                return res.send(HTTPStatus.INTERNAL_SERVER_ERROR);
            }
            res.send(msg, HTTPStatus.OK);
        });
    });

    app.listen(3000);

Contributors
------------

*	David Worms : <https://github.com/wdavidw>
*	Daniel Gasienica : <https://github.com/gasi>
