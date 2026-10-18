param([Parameter(Mandatory=$true)][ValidateSet('install','start','disable','remove','status')][string]$Action,[Parameter(Mandatory=$true)][string]$TaskName,[string]$Launcher)
$ErrorActionPreference='Stop'
# Direct Task Scheduler COM; Node bounds this helper to 15s. Preserve Limited/current-user.
$service=New-Object -ComObject 'Schedule.Service';$service.Connect();$folder=$service.GetFolder('\')
function ReadTask {try{return $folder.GetTask($TaskName)}catch{if($_.Exception.HResult -eq -2147024894){return $null};throw}}
$task=ReadTask
if($Action -eq 'install'){
 if(-not $Launcher -or -not(Test-Path -LiteralPath $Launcher -PathType Leaf)){throw 'Missing launcher'}
 $taskUser=[Security.Principal.WindowsIdentity]::GetCurrent().Name
 $definition=$service.NewTask(0);$definition.RegistrationInfo.Description='Abyss Walker local game supervisor; current user, no elevated privileges.'
 $definition.Principal.UserId=$taskUser;$definition.Principal.LogonType=3;$definition.Principal.RunLevel=0
 $a=$definition.Actions.Create(0);$a.Path="$env:WINDIR\System32\wscript.exe";$a.Arguments='"'+$Launcher+'"';$a.WorkingDirectory=Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $Launcher))
 $trigger=$definition.Triggers.Create(9);$trigger.UserId=$taskUser;$trigger.Enabled=$true
 $definition.Settings.ExecutionTimeLimit='PT0S';$definition.Settings.RestartCount=5;$definition.Settings.RestartInterval='PT1M';$definition.Settings.MultipleInstances=2
 $definition.Settings.DisallowStartIfOnBatteries=$false;$definition.Settings.StopIfGoingOnBatteries=$false;$definition.Settings.StartWhenAvailable=$true;$definition.Settings.Hidden=$true;$definition.Settings.Enabled=$true
 $task=$folder.RegisterTaskDefinition($TaskName,$definition,6,$taskUser,$null,3,$null);$task.Enabled=$true
}elseif($Action -eq 'start'){
 if(-not $task){throw 'Service task is not installed'};$task.Enabled=$true;$task.Run($null)|Out-Null
}elseif($Action -eq 'disable'){if($task){$task.Enabled=$false}}
elseif($Action -eq 'remove'){if($task){$folder.DeleteTask($TaskName,0)}}
$task=ReadTask
if($task){$names=@('Unknown','Disabled','Queued','Ready','Running');@{installed=$true;name=$task.Name;state=$names[[int]$task.State];lastResult=$task.LastTaskResult;runLevel=$(if($task.Definition.Principal.RunLevel -eq 0){'Limited'}else{'Highest'});principal=$task.Definition.Principal.UserId;enabled=$task.Enabled;backend='TaskScheduler COM'}|ConvertTo-Json -Compress}
else{@{installed=$false;name=$TaskName;backend='TaskScheduler COM'}|ConvertTo-Json -Compress}
