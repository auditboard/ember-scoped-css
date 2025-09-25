#!/bin/bash

set -ex

rm -rf dist/ declarations/

cp ../README.md ./README.md
cp ../LICENSE.md ./LICENSE.md

node ./build.mjs

# Types
pnpm tsc --emitDeclarationOnly
