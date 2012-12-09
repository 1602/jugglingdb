{spawn} = require 'child_process'

task 'build', 'Build lib/ from src/', ->
  spawn 'coffee', ['-c', '-o', 'lib', 'src'], stdio: 'inherit'