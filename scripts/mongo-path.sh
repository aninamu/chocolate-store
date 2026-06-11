#!/usr/bin/env bash
# Shared helper: prepend project-supported MongoDB binaries to PATH when needed.

add_mongo_bin_to_path() {
  if command -v brew >/dev/null 2>&1; then
    brew_prefix="$(brew --prefix mongodb-community@7 2>/dev/null || true)"
    if [ -n "$brew_prefix" ] && [ -d "$brew_prefix/bin" ]; then
      export PATH="$brew_prefix/bin:$PATH"
      return
    fi
  fi
}
