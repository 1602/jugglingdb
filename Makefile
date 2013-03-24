# doc:
#	 makedoc lib/abstract-class.js lib/schema.js lib/validatable.js -t "JugglingDB API docs"

test:
	@./node_modules/.bin/mocha --require should test/*.test.js

test-verbose:
	@./node_modules/.bin/mocha --require should --reporter spec test/*.test.js

MAN_DOCS = $(shell find docs -name '*.md' \
               |sed 's|.md|.3|g' \
               |sed 's|docs/|docs/man/|g' )

HTML_DOCS = $(shell find docs -name '*.md' \
               |sed 's|.md|.3.html|g' \
               |sed 's|docs/|docs/html/|g' ) \
							 docs/html/index.html

docs/man/%.3: docs/%.md scripts/doc.sh
	scripts/doc.sh $< $@

docs/html/%.3.html: docs/%.md scripts/doc.sh
	scripts/doc.sh $< $@

docs/html/index.html: docs/jugglingdb.md scripts/doc.sh
	scripts/doc.sh $< $@

man: $(MAN_DOCS)
html: $(HTML_DOCS)

release: man

web: html
	rsync ./docs/html/* jugglingdb.co:/var/www/apps/jugglingdb.co/public

.PHONY: test docs
