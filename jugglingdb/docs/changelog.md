jugglingdb-changelog(3) - The History of JugglingDB
===================================================

## HISTORY

### upcoming release 0.3.0

* Documentation:
  Available in [web](http://jugglingdb.co) and man [jugglingdb(3)]

* **Hooks**:
  Changed format of update and save hooks. Hook accept data as second argument.
  This data could be modified and it will be saved to database after hook done.
  **NOTE**: this change could break some code.

* **Datatypes**:
  Now object casts type of member on assignment. It may cause issues if
  mongodb's ObjectID was manually used as type for property. Solution: not use
  it as type directly, and specify wrapper instead.

* **Model.iterate(opts, iterator, callback)**:
  Async iterator for large datasets.

### 0.2.1

* Introduced `include` method
* Use semver
* Added WebService adapter for client-side compound
* Added array methods to List
* Code cleanup and documenation amends
* Custom type registration
* Browserify-friendly core

### 0.2.0

* Namespace adapter packages (should start with "jugglingdb-")
* Added [nano][jugglingdb-nano] adapter
* Adapters removed from core to separate packages

### 0.1.27

* `autoupdate` fixes for MySQL
* Added `schema.isActual` to check whether migration necessary
* Redis adapter refactored and optimized (fully rewritten)
* Introduce sort-only indexes in redis
* Introduce List API (type: [])
* Update to MySQL 2.0

### 0.1.13

* Validations: sync/async, custom, bugfixes
* MySQL adapter enhancementsenhancements
* DB sync: autoupdate/automigrate
* Ability to overwrite getters/setters
* Resig-style model constructors
* Added [postgres][jugglingdb-postgres] adapter
* Added [sqlite3][jugglingdb-postgres] adapter
* Added [mongodb][jugglingdb-mongodb] adapter
* Redis adapter filter/sort rewriting
* Added `findOne` method
* Custom table names in sqlite, mysql and postgres
* Sequelize adapter removed
* Support `upsert` method
* Delayed db calls (wait for `.on('connected')`)

### 0.0.6

* Tests
* Logging in MySQL and Redis

### 0.0.4

* MySQL adapter
* Indexes in redis
* Neo4j cypher query support

### 0.0.2 (16 Oct 2011)

* Built-in adapters: [redis][jugglingdb-redis], mongoose, sequelize, neo4j
* Scopes
* Conditional validations, null checks everywhere
* Defaults applied on create

### 0.0.1

Package extracted from [RailwayJS MVC](http://railwayjs.com)

## SEE ALSO

jugglingdb-roadmap(3)
