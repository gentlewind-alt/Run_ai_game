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
  $prompt = "Read docs/handoff/codex_tasks_pcg.md and AGENTS.md. Do Task $t exactly as written there (only Task $t), including the Visual references section (the images are attached). Your sandbox may block npm run build, the dev server and the headless-Chrome probes: if so, do NOT stop. Finish the code or docs, run every check that does work (npm run check, python and node scripts), commit locally with the subject required by the brief, and in your final message list exactly which checks could not run. The owner will run those."
  $imgs = @('docs/research/thesis_pages/p102.png', 'docs/research/thesis_pages/p060.png', 'docs/research/thesis_pages/p025.png', 'docs/research/thesis_pages/p107.png')
  Write-Output "$(Get-Date -Format HH:mm) start task $t" | Add-Content "$root\docs\handoff\codex_logs\chain.log"
  & $codex exec --sandbox workspace-write -c sandbox_workspace_write.network_access=true --skip-git-repo-check -i $imgs[0] -i $imgs[1] -i $imgs[2] -i $imgs[3] --output-last-message $out $prompt *> $log
  Write-Output "$(Get-Date -Format HH:mm) end task $t (exit $LASTEXITCODE)" | Add-Content "$root\docs\handoff\codex_logs\chain.log"
}
