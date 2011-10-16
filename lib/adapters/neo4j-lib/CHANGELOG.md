# Changelog: Neo4j driver for Node

## Version 0.2.1 – September 2, 2011

  - Updated `request` dependency. ([@aseemk][])
  - Added Cypher querying and tests. ([@aseemk][])
  - Better error handling. ([@aseemk][])

## Version 0.2.0 – July 14, 2011

  - Massive overhaul of the entire library:
    - Rewrote complete library using [Streamline.js][] ([@aseemk][])
    - Massively extended test suite ([@aseemk][])
    - Implemented `Node.getRelationships` method ([@aseemk][])
    - Implemented `Node.getRelationshipNodes` method ([@aseemk][])
    - Simplified error handling ([@gasi][])
    - Split monolithic file into separate files according to classes ([@aseemk][])
    - Implemented `Node.path` method and `Path` class ([@gasi][])
    - Added `Node.createRelationshipFrom` method ([@gasi][])
    - Fixed numerous bugs ([@aseemk][] & [@gasi][])

## Version 0.1.0 – April 20, 2011

  - Changed name from _Neo4j REST client for Node.js_ to _Neo4j driver for Node_.
  - Rewrote complete library to feature an object-oriented structure.

## Version 0.0.3 – March 26, 2011

  - Updated README.

## Version 0.0.2 – March 26, 2011

  - Renamed top-level constructor to `Client`.
  - Added top-level `serialize` and `deserialize` functions.
  - Added `autoMarshal` argument to `Client` for storing hierarchical data on
    nodes and relationship. Internally uses new `serialize` and `deserialize`
    functions.
  - Changed position of Client's `basePath` argument (now last).
  - Updated test.

## Version 0.0.1 – March 21, 2011

  - Initial release.


[Streamline.js]: https://github.com/Sage/streamlinejs
[@aseemk]: https://github.com/aseemk
[@gasi]: https://github.com/gasi
