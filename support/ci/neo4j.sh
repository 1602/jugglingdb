#!/bin/sh

# travis-ci.org now provides neo4j server but it is not started on boot
which neo4j && sudo neo4j start
sleep 5
