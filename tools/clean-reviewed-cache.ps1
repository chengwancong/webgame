param([switch]$Apply, [switch]$Preflight)
$ErrorActionPreference = 'Stop'
if ($Apply -and $Preflight) { throw 'Use either -Apply or -Preflight, not both.' }
$projectRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent)).TrimEnd('\')
$buildPaths = @(
  'open-world\.qa\hud-polish-20261003-build',
  'open-world\.qa\items-a-20261003-build',
  'open-world\.qa\skills-approved-a-20261003-build',
  'open-world\.qa\upgrade-preview-20261002-build',
  'open-world\.qa\skill-card-layout-20261002-build',
  'open-world\apps\web\.runtime\qa-skill-heading-build',
  'open-world\.runtime\forge-build',
  'open-world\.runtime\vfx-review-build',
  'open-world\.runtime\ground-loot-qa-build',
  'open-world\.runtime\scene-style-review-build',
  'web-build'
)
$cacheNames = @('__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache')
$skipNames = @('.git', 'cloudrealm', 'node_modules', 'data', 'dependencies', 'backups', 'source-assets')
$targets = [Collections.Generic.List[object]]::new()
function Assert-OwnedPath([string]$Path) {
  $absolute = [IO.Path]::GetFullPath($Path)
  if (-not $absolute.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "Target outside project: $absolute"
  }
  $relative = $absolute.Substring($projectRoot.Length + 1)
  if ($relative -match '(^|\\)(cloudrealm|\.git|node_modules)(\\|$)' -or
      $relative -match '^open-world\\\.runtime\\(dev|service|dependencies|backups)(\\|$)') {
    throw "Protected target: $relative"
  }
  $ancestor = $absolute
  while ($ancestor.Length -gt $projectRoot.Length) {
    if (Test-Path -LiteralPath $ancestor) {
      if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw "Linked target or parent: $ancestor"
      }
    }
    $ancestor = [IO.Path]::GetDirectoryName($ancestor)
  }
  return $absolute
}
function Measure-OwnedTree([string]$Path) {
  $item = Get-Item -LiteralPath $Path -Force
  if (-not $item.PSIsContainer) { return @{bytes=[long]$item.Length;files=1} }
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push($Path)
  $bytes = [long]0; $files = 0
  while ($pending.Count) {
    foreach ($entry in Get-ChildItem -LiteralPath $pending.Pop() -Force) {
      if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Nested link: $($entry.FullName)" }
      if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
      else {
        if ($entry.Name -in @('PG_VERSION', 'postmaster.pid', 'owner.json')) { throw "Database or ownership record: $($entry.FullName)" }
        $bytes += $entry.Length; $files++
      }
    }
  }
  return @{bytes=$bytes;files=$files}
}
function Add-Target([string]$Path, [string]$Category) {
  $absolute = Assert-OwnedPath $Path
  if (-not (Test-Path -LiteralPath $absolute)) { return }
  $size = Measure-OwnedTree $absolute
  $targets.Add([pscustomobject]@{path=$absolute;category=$Category;bytes=$size.bytes;files=$size.files})
}
foreach ($relative in $buildPaths) { Add-Target (Join-Path $projectRoot $relative) 'historical-build' }
$blenderRoot = Join-Path $projectRoot 'experiments\quaternius-3d\.tools\blender'
if (Test-Path -LiteralPath (Join-Path $blenderRoot 'portable\blender-4.5.14-windows-x64\blender.exe')) {
  Add-Target (Join-Path $blenderRoot 'downloads\blender-4.5.14-windows-x64.zip') 'installer-cache'
}
$pending = [Collections.Generic.Stack[string]]::new(); $pending.Push($projectRoot)
while ($pending.Count) {
  foreach ($entry in Get-ChildItem -LiteralPath $pending.Pop() -Directory -Force) {
    if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint -or $entry.Name -in $skipNames) { continue }
    if ($entry.Name -in $cacheNames) { Add-Target $entry.FullName 'python-cache' }
    else { $pending.Push($entry.FullName) }
  }
}
$groups = @($targets | Group-Object category | ForEach-Object {
  [pscustomobject]@{category=$_.Name;targets=$_.Count;bytes=[long](($_.Group | Measure-Object bytes -Sum).Sum);files=[long](($_.Group | Measure-Object files -Sum).Sum)}
})
$groups | Format-Table -AutoSize
Write-Host ('Planned file bytes: ' + [long](($targets | Measure-Object bytes -Sum).Sum))
if (-not ($Apply -or $Preflight)) {
  $targets | Select-Object path,bytes | Format-Table -AutoSize
  Write-Host 'Preview only. Nothing deleted. Add -Apply to execute this reviewed list.'
  exit 0
}
# Standalone native process inspection. No helper scripts or WMI are needed.
if (-not ('AwCleanupNative' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class AwCleanupNative {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int id);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr handle, IntPtr address, byte[] buffer, int length, out IntPtr read);
  [DllImport("kernel32.dll")] static extern bool IsWow64Process(IntPtr handle, out bool wow64);
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr handle, int kind, IntPtr buffer, int length, out int returned);
  static byte[] Read(IntPtr handle, IntPtr address, int length) {
    if (length < 0 || length > 65536) throw new Exception("Invalid native read length");
    byte[] buffer = new byte[length]; IntPtr read;
    if (!ReadProcessMemory(handle, address, buffer, length, out read) || read.ToInt64() != length)
      throw new Exception("Process memory unreadable: " + Marshal.GetLastWin32Error());
    return buffer;
  }
  static IntPtr Pointer(byte[] bytes, int offset) {
    return IntPtr.Size == 8 ? new IntPtr(BitConverter.ToInt64(bytes, offset)) : new IntPtr(BitConverter.ToInt32(bytes, offset));
  }
  static IntPtr Parameters(IntPtr handle) {
    bool wow64;
    if (!IsWow64Process(handle, out wow64) || (wow64 && IntPtr.Size == 8))
      throw new Exception("Cross-bitness process inspection unsupported");
    IntPtr buffer = Marshal.AllocHGlobal(IntPtr.Size * 6);
    try {
      int returned;
      int status = NtQueryInformationProcess(handle, 0, buffer, IntPtr.Size * 6, out returned);
      if (status < 0) throw new Exception("Process query failed: " + status);
      IntPtr peb = Marshal.ReadIntPtr(buffer, IntPtr.Size);
      return Pointer(Read(handle, IntPtr.Add(peb, IntPtr.Size == 8 ? 32 : 16), IntPtr.Size), 0);
    } finally { Marshal.FreeHGlobal(buffer); }
  }
  static string Unicode(IntPtr handle, IntPtr descriptorAddress) {
    byte[] descriptor = Read(handle, descriptorAddress, IntPtr.Size == 8 ? 16 : 8);
    int length = BitConverter.ToUInt16(descriptor, 0);
    if (length == 0) return "";
    return Encoding.Unicode.GetString(Read(handle, Pointer(descriptor, IntPtr.Size == 8 ? 8 : 4), length));
  }
  public static string[] Inspect(int id) {
    IntPtr handle = OpenProcess(0x0410, false, id);
    if (handle == IntPtr.Zero) throw new Exception("Process query denied: " + Marshal.GetLastWin32Error());
    try {
      IntPtr parameters = Parameters(handle);
      int commandOffset = 16 + 10 * IntPtr.Size + (IntPtr.Size == 8 ? 16 : 8);
      return new string[] {
        Unicode(handle, IntPtr.Add(parameters, commandOffset)),
        Unicode(handle, IntPtr.Add(parameters, IntPtr.Size == 8 ? 56 : 36))
      };
    } finally { CloseHandle(handle); }
  }
}
'@
}
$checkedProcesses = 0
foreach ($process in Get-Process -Name node,python,python3,blender,'godot*' -ErrorAction SilentlyContinue) {
  try { $identity = [AwCleanupNative]::Inspect($process.Id) }
  catch {
    if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { continue }
    throw "Process identity unreadable; no deletion: $($process.Id). $($_.Exception.Message)"
  }
  $line = $identity[0]; $workingDirectory = $identity[1]; $checkedProcesses++
  foreach ($target in $targets) {
    if ($line.IndexOf($target.path, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
        $workingDirectory.TrimEnd('\').Equals($target.path, [StringComparison]::OrdinalIgnoreCase) -or
        $workingDirectory.StartsWith($target.path + '\', [StringComparison]::OrdinalIgnoreCase) -or
        ($target.category -eq 'historical-build' -and $line.IndexOf([IO.Path]::GetFileName($target.path), [StringComparison]::OrdinalIgnoreCase) -ge 0)) {
      throw "Target referenced by active process $($process.Id): $($target.path)"
    }
  }
  if ($line -match '(serve-vfx-review|http-server|serve-handler|serve-static)' -or $process.ProcessName -match 'blender|godot') {
    throw "Review or asset process active; stop that preview before cleanup: $($process.Id)"
  }
}
$healthBefore = Invoke-RestMethod -Uri 'http://127.0.0.1:8612/api/health' -TimeoutSec 10
$statePath = Join-Path $projectRoot 'open-world\.runtime\service\state.json'
$serviceBefore = (Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json).pid
if (-not $healthBefore.ok) { throw 'Game health check failed; no deletion.' }
foreach ($target in $targets) {
  $absolute = Assert-OwnedPath $target.path
  $size = Measure-OwnedTree $absolute
  if ($size.bytes -ne $target.bytes -or $size.files -ne $target.files) { throw "Target changed during preflight: $absolute" }
}
if ($Preflight) {
  Write-Host ('Preflight passed. Processes inspected: ' + $checkedProcesses)
  Write-Host 'Paths, process usage, game health and service state checked. Nothing deleted.'
  exit 0
}
$deleted = [Collections.Generic.List[object]]::new(); $errors = [Collections.Generic.List[object]]::new()
foreach ($target in $targets) {
  try {
    $absolute = Assert-OwnedPath $target.path
    if (-not (Test-Path -LiteralPath $absolute)) { continue }
    $size = Measure-OwnedTree $absolute
    if ($size.bytes -ne $target.bytes -or $size.files -ne $target.files) { throw "Target changed during review: $absolute" }
    Remove-Item -LiteralPath $absolute -Recurse -Force -ErrorAction Stop
    if (Test-Path -LiteralPath $absolute) { throw "Removal incomplete: $absolute" }
    $deleted.Add($target)
  } catch { $errors.Add(@{path=$target.path;error=$_.Exception.Message}) }
}
$healthAfter = Invoke-RestMethod -Uri 'http://127.0.0.1:8612/api/health' -TimeoutSec 10
$report = @{completedAt=[DateTime]::UtcNow.ToString('o');deleted=$deleted;errors=$errors;removedBytes=[long](($deleted | Measure-Object bytes -Sum).Sum);healthBefore=$healthBefore;healthAfter=$healthAfter;servicePidUnchanged=($serviceBefore -eq (Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json).pid);databaseRetained=(Test-Path -LiteralPath (Join-Path $projectRoot 'open-world\.runtime\dev\data\PG_VERSION'))}
$reportPath = Join-Path $projectRoot 'docs\reviews\open-world\cache-cleanup-20261004.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host ('Removed file bytes: ' + $report.removedBytes)
Write-Host ('Report: ' + $reportPath)
if ($errors.Count) { $errors | Format-Table -AutoSize; exit 1 }
