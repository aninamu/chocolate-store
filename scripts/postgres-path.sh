#!/usr/bin/env bash
# Shared helper: prepend project-supported Postgres binaries to PATH when needed.

add_postgres_bin_to_path() {
  brew_prefix=""

  if command -v brew >/dev/null 2>&1; then
    brew_prefix="$(brew --prefix postgresql@16 2>/dev/null || true)"
    if [ -d "$brew_prefix/bin" ]; then
      export PATH="$brew_prefix/bin:$PATH"
      return
    fi
  fi

  if [ -d /usr/lib/postgresql/16/bin ]; then
    export PATH="/usr/lib/postgresql/16/bin:$PATH"
  fi
}
