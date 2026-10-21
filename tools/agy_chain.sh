#!/bin/bash
# Runs agy briefs one after another: tools/agy_chain.sh docs/handoff/agy_task_a.md docs/handoff/agy_task_b.md
for brief in "$@"; do
  agy --model gemini-3.8-flash-high --print-timeout 0 -p "Read $brief and do exactly that task." > /dev/null 2>&1
done
