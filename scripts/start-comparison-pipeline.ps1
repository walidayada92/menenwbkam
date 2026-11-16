$ErrorActionPreference = 'Stop'
$pipelineRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pipelineLogs = Join-Path $pipelineRoot '.local/comparison-pipeline'
New-Item -ItemType Directory -Force -Path $pipelineLogs | Out-Null
$pipelineStatePath = Join-Path $pipelineLogs 'processes.json'
$pipelinePrevious = if (Test-Path -LiteralPath $pipelineStatePath) { Get-Content -LiteralPath $pipelineStatePath -Raw | ConvertFrom-Json } else { @() }
$pipelineProcesses = @()
$pipelineNode = (Get-Command node.exe).Source
foreach ($pipelineRole in @('scheduler', 'worker', 'processor')) {
  $pipelineEntryPoint = if ($pipelineRole -eq 'processor') { 'worker' } else { $pipelineRole }
  $pipelineScript = Join-Path $pipelineRoot "apps/api/dist/external-sync/$pipelineEntryPoint.js"
  if (!(Test-Path -LiteralPath $pipelineScript)) { throw "Build the API first: npm.cmd run build --workspace=api" }
  $pipelineExisting = $pipelinePrevious | Where-Object { $_.role -eq $pipelineRole } | Select-Object -First 1
  if ($pipelineExisting) {
    $pipelineLive = Get-CimInstance Win32_Process -Filter "ProcessId = $($pipelineExisting.pid)" -ErrorAction SilentlyContinue
    if ($pipelineLive -and $pipelineLive.CommandLine -and $pipelineLive.CommandLine.Contains($pipelineScript)) {
      $pipelineProcesses += $pipelineExisting
      Write-Output "$pipelineRole already running (PID $($pipelineExisting.pid))"
      continue
    }
  }
  $pipelineEnvPath = Join-Path $pipelineRoot '.env'
  $pipelineArgs = @("`"--env-file-if-exists=$pipelineEnvPath`"", "`"$pipelineScript`"")
  if ($pipelineRole -eq 'processor') { $pipelineArgs += '--kinds=MATCH,INDEX' }
  $pipelineProcess = Start-Process -FilePath $pipelineNode -ArgumentList $pipelineArgs -WorkingDirectory (Join-Path $pipelineRoot 'apps/api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $pipelineLogs "$pipelineRole.log") -RedirectStandardError (Join-Path $pipelineLogs "$pipelineRole-error.log") -PassThru
  $pipelineProcesses += [pscustomobject]@{ role = $pipelineRole; pid = $pipelineProcess.Id; script = $pipelineScript }
  Write-Output "Started $pipelineRole (PID $($pipelineProcess.Id))"
}
$pipelineProcesses | ConvertTo-Json | Set-Content -LiteralPath $pipelineStatePath
Write-Output "Logs: $pipelineLogs"
