# Neo4j driver for Node

This driver let's you access the [Neo4j graph database][neo4j] from Node.


## Installation

    npm install neo4j


## Development

    git clone git@github.com:gasi/node-neo4j.git neo4j
    cd neo4j
    npm link

You'll also need a local Neo4j database instance for the tests:

    curl http://dist.neo4j.org/neo4j-community-1.3-unix.tar.gz --O neo4j-community-1.3-unix.tar.gz
    tar -zxvf neo4j-community-1.3-unix.tar.gz
    mv neo4j-community-1.3 db

If you're new to Neo4j, read the [Getting Started][neo4j-getting-started] page.
Start the server:

    db/bin/neo4j start

Stop the server:

    db/bin/neo4j stop

To run the tests:

    npm test


## Usage

    var neo4j = require('neo4j');
    var db = new neo4j.GraphDatabase('http://localhost:7474');

    function print(err, res) {
        console.log(err || res);
    }

    var node = db.createNode({hello: 'world'});
    node.save(print);

## License

This library is licensed under the [Apache License, Version 2.0][license].


## Reporting Issues

If you encounter any bugs or other issues, please file them in the
[issue tracker][issue-tracker].


[neo4j]: http://neo4j.org/
[neo-rest-api]: http://components.neo4j.org/neo4j-server/snapshot/rest.html
[neo4j-getting-started]: http://wiki.neo4j.org/content/Getting_Started_With_Neo4j_Server
[issue-tracker]: https://github.com/gasi/node-neo4j/issues
[license]: http://www.apache.org/licenses/LICENSE-2.0.html
