
test:
	@ONLY=memory ./support/nodeunit/bin/nodeunit test/*_test.*

.PHONY: test
