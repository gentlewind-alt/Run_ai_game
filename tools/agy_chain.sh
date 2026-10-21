#!/bin/bash
# Runs agy briefs one after another with the owner's tool-routing rule:
#   1. agy with gemini-3.8-flash-high   2. agy with claude-sonnet-4-6 (fallback)   3. gemini again   then stop.
# A brief counts as finished only when agy appended the line "DONE <brief-name>" to docs/handoff/agy_done.txt.
# If a brief is still unfinished after all attempts the chain stops and writes "INCOMPLETE <brief-name>" (do the rest directly).
# usage (repo root): bash tools/agy_chain.sh docs/handoff/agy_task_a.md docs/handoff/agy_task_b.md
DONE=docs/handoff/agy_done.txt
touch "$DONE"
for brief in "$@"; do
  name=$(basename "$brief" .md)
  for model in gemini-3.8-flash-high claude-sonnet-4-6 gemini-3.8-flash-high; do
    grep -q "^DONE $name\$" "$DONE" && break
    echo "$(date +%H:%M) start $name with $model" >> docs/handoff/agy_chain.log
    agy --model "$model" --print-timeout 0 -p "Read $brief and do exactly that task. If an earlier run already did part of it (see git status and docs/handoff/LOG.md), continue from there. When completely finished (all required checks passing and the LOG.md entry written), append the single line 'DONE $name' to docs/handoff/agy_done.txt." > /dev/null 2>&1
  done
  if ! grep -q "^DONE $name\$" "$DONE"; then
    echo "INCOMPLETE $name" >> "$DONE"
    echo "$(date +%H:%M) INCOMPLETE $name, chain stopped" >> docs/handoff/agy_chain.log
    break
  fi
  echo "$(date +%H:%M) done $name" >> docs/handoff/agy_chain.log
done
