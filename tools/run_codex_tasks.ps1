# Runs the four PCG tasks in docs/handoff/codex_tasks_pcg.md one after another with the Codex CLI (desktop app build).
# usage (repo root): powershell -NoProfile -File tools/run_codex_tasks.ps1 [A B C D]
param([string[]]$Tasks = @('A', 'B', 'C', 'D'))
$codex = Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin" -Recurse -Filter codex.exe | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force "$root\docs\handoff\codex_logs" | Out-Null
foreach ($t in $Tasks) {
  $out = "$root\docs\handoff\codex_logs\task_$t.txt"
  $log = "$root\docs\handoff\codex_logs\task_$t.log"
  $prompt = "Read docs/handoff/codex_tasks_pcg.md and AGENTS.md. Do Task $t exactly as written there (only Task $t), including its checks and commit. If something blocks you, say what and stop."
  Write-Output "$(Get-Date -Format HH:mm) start task $t" | Add-Content "$root\docs\handoff\codex_logs\chain.log"
  & $codex exec --sandbox workspace-write -c sandbox_workspace_write.network_access=true --skip-git-repo-check --output-last-message $out $prompt *> $log
  Write-Output "$(Get-Date -Format HH:mm) end task $t (exit $LASTEXITCODE)" | Add-Content "$root\docs\handoff\codex_logs\chain.log"
}
