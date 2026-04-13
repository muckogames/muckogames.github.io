#!/bin/sh
# sync-ios.sh — Copy web assets from samster/ into the iOS app bundle.
# Run this before building the Xcode project to keep the app in sync.

set -e

SRC="$(dirname "$0")/samster"
DST="$(dirname "$0")/samster-ios/Samster/Samster"

echo "Syncing samster web assets → iOS bundle..."
cp "$SRC/index.html"     "$DST/index.html"
cp "$SRC/dialog-data.js" "$DST/dialog-data.js"
echo "Done. Synced:"
echo "  $SRC/index.html     → $DST/index.html"
echo "  $SRC/dialog-data.js → $DST/dialog-data.js"
