doc:
	makedoc lib/abstract-class.js lib/schema.js lib/validatable.js -t "JugglingDB API docs"

test:
	@ONLY=memory ./support/nodeunit/bin/nodeunit test/*_test.*

.PHONY: test
.PHONY: doc
