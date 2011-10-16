/*

    Neo4j driver for Node

    Copyright 2011 Daniel Gasienica <daniel@gasienica.ch>
    Copyright 2011 Aseem Kishore <aseem.kishore@gmail.com>

    Licensed under the Apache License, Version 2.0 (the "License"); you may
    not use this file except in compliance with the License. You may obtain
    a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
    WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
    License for the specific language governing permissions and limitations
    under the License.

*/

require('coffee-script');
require('streamline');

exports.GraphDatabase = require('./GraphDatabase_');

// XXX serialize functions not used internally right now, but used by outside
// clients, e.g. the scrapedb script. TODO formalize these better?
var util = require('./util_');
exports.serialize = util.serialize;
exports.deserialize = util.deserialize;
