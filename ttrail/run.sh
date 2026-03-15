#!/bin/bash
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DIR/out"
javac -d "$DIR/out" "$DIR/TitanicTrail.java"
if [ $? -eq 0 ]; then
  java -cp "$DIR/out" TitanicTrail
else
  echo "Compilation failed."
  exit 1
fi
