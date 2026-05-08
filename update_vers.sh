#!/bin/sh

VERSION=$(jq -r .version dist/release/manifest.json)
grep -iEHlr "\?version=version" dist/release | xargs sed -i "s/?version=version/?version=%VERS%/g"
