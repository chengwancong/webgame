param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Review,[int]$WaitPid=0,[string]$ResumeAfter='')
$ErrorActionPreference='Stop'
$spineSource=(Resolve-Path -LiteralPath $Source).Path
$spineOwner=Get-Content -LiteralPath (Join-Path (Split-Path $spineSource) 'owner.json') -Raw | ConvertFrom-Json
if ($spineOwner.owner -ne 'numeric-spine-20261013' -or $spineOwner.source -ne $spineSource) { throw '验证目录所有权不匹配' }
$spineReview=[IO.Path]::GetFullPath($Review)
if ($spineReview -ne [IO.Path]::GetFullPath((Join-Path $spineOwner.root 'docs/reviews/numeric-spine-20261013'))) { throw '评审目录不匹配' }
$spineSteps=[Collections.Generic.List[object]]::new()
$spineSavedPg=$env:AW_PG_BIN
$script:spineSkipUntil=$ResumeAfter
if ($ResumeAfter) {
 $spinePrior=Get-Content -LiteralPath (Join-Path $spineReview 'S8/verification-pipeline-summary.json') -Raw | ConvertFrom-Json
 foreach ($spineStep in $spinePrior.steps) { $spineSteps.Add($spineStep);if($spineStep.name -eq $ResumeAfter){break} }
}
function Save-State([string]$Status) {
 @{status=$Status;source=$spineSource;rules='ow-71';steps=$spineSteps;updated=(Get-Date).ToString('o')} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $spineReview 'S8/verification-pipeline-summary.json') -Encoding utf8NoBOM
}
function Run-Step([string]$Name,[string]$Program,[string[]]$Arguments,[string]$Log) {
 if ($script:spineSkipUntil) { if($Name -eq $script:spineSkipUntil){$script:spineSkipUntil=''};return }
 Save-State ('运行：'+$Name)
 $spineStart=Get-Date
 & $Program @Arguments *> (Join-Path $spineReview $Log)
 $spineExit=$LASTEXITCODE
 $spineSteps.Add(@{name=$Name;exitCode=$spineExit;seconds=((Get-Date)-$spineStart).TotalSeconds;log=$Log})
 Save-State ('结束：'+$Name)
 if ($spineExit -ne 0) { throw ($Name+'失败，见 '+$Log) }
}
try {
 Save-State '等待先前重任务退出'
 if ($WaitPid -and (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue)) { Wait-Process -Id $WaitPid }
 while ($true) {
  $spineOther=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'vitest.mjs|typescript[/\\].*tsc|vite.*build|numeric.*\.(mjs|ts|py)|build-isolated.mjs|tools[/\\]pacing[/\\]run-tests.mjs' }
  if (-not $spineOther) { break }
  foreach ($spineJob in $spineOther) { Wait-Process -Id $spineJob.ProcessId -ErrorAction SilentlyContinue }
 }
 Set-Location -LiteralPath $spineSource
 $env:AW_PG_BIN=Join-Path $spineOwner.root '.runtime/dependencies/pgsql/bin'
 if (-not (Test-Path -LiteralPath (Join-Path $env:AW_PG_BIN 'initdb.exe'))) { throw '原工作区PostgreSQL二进制不存在' }
 $spinePython='C:/Users/ccc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
 Run-Step '主工程类型检查' 'node' @('node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.json') 'S8/isolated-types.log'
 Run-Step '主干工具类型检查' 'node' @('node_modules/typescript/bin/tsc','--noEmit','-p','tools/spine/tsconfig.json') 'S8/isolated-tools-types.log'
 Run-Step 'S4冻结弹性复核' 'node' @('--import','tsx','tools/spine/rebase-elasticities.ts',$spineReview) 'S8/measurement-repair/rebase-elasticities.log'
 Run-Step '旋钮Excel同步' $spinePython @('-X','utf8','tools/spine/sync-knobs.py','--from-spine',('--out='+$spineReview+'/S8/measurement-repair/rebased')) 'S8/measurement-repair/sync-knobs.log'
 Run-Step '配置导出' $spinePython @('-X','utf8','tools/config-export.py') 'S8/isolated-config-export.log'
 Run-Step '配置一致性' $spinePython @('-X','utf8','tools/config-export.py','--check') 'S8/isolated-config-check.log'
 Run-Step '受影响场景复核与数值报告汇总' 'node' @('--import','tsx','tools/spine/revalidate-final.ts',$spineReview) 'S8/final-validation.log'
 Run-Step '全量回归及两种自然策略' 'node' @('tools/spine/with-python.mjs',$spinePython,'docs/reviews/numeric-spine-20261013/S8/final-isolated-tests-env','node','tools/pacing/run-tests.mjs',($spineReview+'/S8/final-isolated-tests'),'--all') 'S8/final-isolated-tests-driver.log'
 Run-Step '正式隔离构建' 'node' @('tools/spine/with-python.mjs',$spinePython,'docs/reviews/numeric-spine-20261013/S8/final-isolated-build-env','node','tools/pacing/build-isolated.mjs',('--out='+$spineReview+'/S8/final-isolated-build')) 'S8/final-isolated-build-driver.log'
 Save-State '验证流水线完成；数值是否达标单独读取final-validation'
} catch {
 Save-State ('停止：'+$_.Exception.Message)
 throw
} finally {
 $env:AW_PG_BIN=$spineSavedPg
}
