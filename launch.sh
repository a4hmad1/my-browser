#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1
unset ELECTRON_RUN_AS_NODE
exec node scripts/start-desktop.js "$@"
