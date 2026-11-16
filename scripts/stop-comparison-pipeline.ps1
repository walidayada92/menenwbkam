$ErrorActionPreference = 'Stop'
$pipelineRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pipelineStatePath = Join-Path $pipelineRoot '.local/comparison-pipeline/processes.json'
if (!(Test-Path -LiteralPath $pipelineStatePath)) { Write-Output 'No recorded pipeline processes.'; return }
foreach ($pipelineEntry in (Get-Content -LiteralPath $pipelineStatePath -Raw | ConvertFrom-Json)) {
  if ($pipelineEntry.role -notin @('scheduler', 'worker', 'processor')) { throw 'Unexpected role in pipeline process file' }
  $pipelineEntryPoint = if ($pipelineEntry.role -eq 'processor') { 'worker' } else { $pipelineEntry.role }
  $pipelineExpected = Join-Path $pipelineRoot "apps/api/dist/external-sync/$pipelineEntryPoint.js"
  $pipelineLive = Get-CimInstance Win32_Process -Filter "ProcessId = $($pipelineEntry.pid)" -ErrorAction SilentlyContinue
  if (!$pipelineLive) { continue }
  if (!$pipelineLive.CommandLine -or !$pipelineLive.CommandLine.Contains($pipelineExpected)) { throw "PID $($pipelineEntry.pid) no longer belongs to this pipeline; refusing to stop it" }
  Stop-Process -Id $pipelineEntry.pid
  Write-Output "Stopped $($pipelineEntry.role) (PID $($pipelineEntry.pid)). Active jobs remain durable and recover after lease expiry."
}
