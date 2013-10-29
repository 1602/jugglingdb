jugglingdb-schema(3) - Everything about schema, data types and model definition.
====================

## DESCRIPTION

Schema is a factory for classes. Schema connected with specific database using
adapter. 

All classes within single schema shares same adapter type and one database
connection. But it's possible to use more than one schema to connect with
different databases.

## EVENTS

Instances of Schema are event emitters, events supported by default:

* `.on('connected', function() {})`:
  Fired when db connection established. Params: none.
* `.on('log', function(msg, duration) {})`:
  Fired when adapter logged line. Params: String message, Number duration

## USAGE

### Creating schema

`Schema` constructor available on `jugglingdb` module:

    var Schema = require('jugglingdb').Schema;

Schema constructor accepts two arguments. First argument is adapter. It could be
adapter name or adapter package:

    var schemaByAdapterName = new Schema('memory');
    var schemaByAdapterPackage = new Schema(require('redis'));

### Settings

Second argument is optional settings. Settings object format and defaults
depends on specific adapter, but common fields are:

* `host`:
Database host
* `port`:
Database port
* `username`:
Username to connect to database
* `password`:
Password to connect to database
* `database`:
Database name
* `debug`:
Turn on verbose mode to debug db queries and lifecycle

For adapter-specific settings refer to adapter's readme file.

### Connecting to database

Schema connecting to database automatically. Once connection established schema
object emit 'connected' event, and set `connected` flag to true, but it is not
necessary to wait for 'connected' event because all queries cached and executed
when schema emit 'connected' event.

To disconnect from database server call `schema.disconnect` method. This call
forwarded to adapter if adapter have ability to connect/disconnect.

### Model definition

To define model schema have single method `schema.define`. It accepts three
argumets:

* **model name**:
  String name in camel-case with first upper-case letter. This name will be used
  later to access model.
* **properties**:
  Object with property type definitions. Key is property name, value is type
  definition. Type definition can be function representing type of property
  (String, Number, Date, Boolean), or object with {type: String|Number|...,
  index: true|false} format.
* **settings**:
  Object with model-wide settings such as `tableName` or so.

Examples of model definition:

    var User = schema.define('User', {
        email: String,
        password: String,
        birthDate: Date,
        activated: Boolean
    });

    var User = schema.define('User', {
        email: { type: String, limit: 150, index: true },
        password: { type: String, limit: 50 },
        birthDate: Date,
        registrationDate: {
            type: Date,
            default: function () { return new Date }
        },
        activated: { type: Boolean, default: false }
    }, {
        table: 'users'
    });

### DB structure syncronization

Schema instance have two methods for updating db structure: automigrate and
autoupdate.

The `automigrate` method drop table (if exists) and create it again,
`autoupdate` method generates ALTER TABLE query. Both method accepts callback
called when migration/update done.

To check if any db changes required use `isActual` method. It accepts single
`callback` argument, which receive boolean value depending on db state: false if
db structure outdated, true when schema and db is in sync:

    schema.isActual(function(err, actual) {
        if (!actual) {
            schema.autoupdate();
        }
    });

## SEE ALSO

jugglingdb-model(3)
jugglingdb-adapter(3)
