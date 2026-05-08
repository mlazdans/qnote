#!/bin/sh

mkdir -p dist/release
cp -ru \
  src/_locales \
  src/html \
  src/images \
  src/schemas \
  src/manifest.json \
  src/background.html \
  dist/release/
