## TESTS

TESTER = ./node_modules/.bin/mocha
OPTS = --growl
TESTS = test/*.test.js

test:
	$(TESTER) $(OPTS) $(TESTS)
test-verbose:
	$(TESTER) $(OPTS) --reporter spec $(TESTS)
testing:
	$(TESTER) $(OPTS) --watch $(TESTS)

about-testing:
	@echo "\n## TESTING\n"
	@echo "  make test               # Run all tests in silent mode"
	@echo "  make test-verbose       # Run all tests in verbose mode"
	@echo "  make testing            # Run tests continuously"

## DOCS

MAN_DOCS = $(shell find docs -name '*.md' \
               |sed 's|.md|.3|g' \
               |sed 's|docs/|docs/man/|g' )

HTML_DOCS = $(shell find docs -name '*.md' \
               |sed 's|.md|.3.html|g' \
               |sed 's|docs/|docs/html/|g' ) \
							 docs/html/index.html

docs/man/%.3: docs/%.md scripts/doc.sh
	scripts/doc.sh $< $@

docs/html/%.3.html: docs/%.md scripts/doc.sh docs/footer.html
	scripts/doc.sh $< $@

docs/html/index.html: docs/jugglingdb.md scripts/doc.sh docs/footer.html
	scripts/doc.sh $< $@

man: $(MAN_DOCS)
html: $(HTML_DOCS)

build: man

web: html
	rsync ./docs/html/* jugglingdb.co:/var/www/apps/jugglingdb.co/public

about-docs:
	@echo "\n## DOCS\n"
	@echo "  make man                # Create docs for man"
	@echo "  make html               # Create docs in html"
	@echo "  make web                # Publish docs to jugglingdb.co"

## WORKFLOW

GITBRANCH = $(shell git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/\1/')

REPO = marcusgreenwood/hatchjs
TARGET = origin
FROM = $(GITBRANCH)
TO = $(GITBRANCH)

pull:
	git pull $(TARGET) $(FROM)

safe-pull:
	git pull $(TARGET) $(FROM) --no-commit

push: test
	git push $(TARGET) $(TO)

feature:
	git checkout -b feature-$(filter-out $@,$(MAKECMDGOALS))
	git push -u $(TARGET) feature-$(filter-out $@,$(MAKECMDGOALS))
%:
	@:

version-build:
	@echo "Increasing version build, publishing package, then push, hit Ctrl+C to skip before 'three'"
	@sleep 1 && echo 'one...'
	@sleep 1 && echo 'two...'
	@sleep 1 && echo 'three!'
	@sleep 1
	npm version build && npm publish && git push

about-workflow:
	@echo "\n## WORKFLOW\n"
	@echo "  make pull               # Pull changes from current branch"
	@echo "  make push               # Push changes to current branch"
	@echo "  make feature {name}     # Create feature branch 'feature-name'"
	@echo "  make pr                 # Make pull request"
	@echo "  make version-build      # Create new build version"

## HELP

help: about-testing about-docs about-workflow

.PHONY: test docs
