#!/bin/sh

RELEASE_DIR=dist/release
rm -rf "$RELEASE_DIR"

./node_modules/.bin/tsc
./build.sh
./update_vers.sh

VERSION=$(jq -r .version "$RELEASE_DIR/manifest.json")
filename="qnote-${VERSION}.xpi"

if [ -e "$filename" ]; then
	echo "$filename exists, removing"
  rm "$filename"
fi

cd "$RELEASE_DIR" && zip -rq "$OLDPWD/$filename" *
