#!/bin/bash
node --experimental-modules --es-module-specifier-resolution=node  ./dist/runner.js $@
