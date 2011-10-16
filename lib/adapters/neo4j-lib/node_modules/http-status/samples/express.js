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
