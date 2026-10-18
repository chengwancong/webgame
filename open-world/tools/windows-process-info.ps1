param([Parameter(Mandatory=$true)][int]$ProcessId,[ValidateSet('one','children','ancestors')][string]$Mode='one')
$ErrorActionPreference='Stop'
# Native, read-only identity. Caller bounds this helper; no WMI/management provider.
# Layout: Microsoft NtQueryInformationProcess(0) and RTL_USER_PROCESS_PARAMETERS.
Add-Type -TypeDefinition @'
using System; using System.Diagnostics; using System.Runtime.InteropServices; using System.Text;
public static class AwNativeProcess {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int id);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h,IntPtr p,byte[] b,int n,out IntPtr read);
 [DllImport("kernel32.dll")] static extern bool IsWow64Process(IntPtr h,out bool value);
 [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h,int kind,IntPtr buffer,int length,out int returned);
 static byte[] Read(IntPtr h,IntPtr p,int n) {if(n<0||n>65536)throw new Exception("Invalid native read length");byte[] b=new byte[n];IntPtr read;if(!ReadProcessMemory(h,p,b,n,out read)||read.ToInt64()!=n)throw new Exception("Native read denied: "+Marshal.GetLastWin32Error());return b;}
 static IntPtr Pointer(byte[] b,int o) {return IntPtr.Size==8?new IntPtr(BitConverter.ToInt64(b,o)):new IntPtr(BitConverter.ToInt32(b,o));}
 static IntPtr Basic(IntPtr h,out int parent) {IntPtr b=Marshal.AllocHGlobal(IntPtr.Size*6);try{int count,status=NtQueryInformationProcess(h,0,b,IntPtr.Size*6,out count);if(status<0)throw new Exception("Native query failed: "+status);parent=Marshal.ReadIntPtr(b,IntPtr.Size*5).ToInt32();return Marshal.ReadIntPtr(b,IntPtr.Size);}finally{Marshal.FreeHGlobal(b);}}
 public static int Parent(int id) {IntPtr h=OpenProcess(0x1000,false,id);if(h==IntPtr.Zero)throw new Exception("Process query denied");try{int parent;Basic(h,out parent);return parent;}finally{CloseHandle(h);}}
 public static string Command(int id) {IntPtr h=OpenProcess(0x0410,false,id);if(h==IntPtr.Zero)throw new Exception("Process command query denied: "+Marshal.GetLastWin32Error());try{bool wow;if(!IsWow64Process(h,out wow)||wow&&IntPtr.Size==8)throw new Exception("Cross-bitness identity unsupported; no PID fallback");int parent;IntPtr peb=Basic(h,out parent);IntPtr parameters=Pointer(Read(h,IntPtr.Add(peb,IntPtr.Size==8?32:16),IntPtr.Size),0);int offset=16+10*IntPtr.Size+(IntPtr.Size==8?16:8);byte[] descriptor=Read(h,IntPtr.Add(parameters,offset),IntPtr.Size==8?16:8);int length=BitConverter.ToUInt16(descriptor,0);return Encoding.Unicode.GetString(Read(h,Pointer(descriptor,IntPtr.Size==8?8:4),length));}finally{CloseHandle(h);}}
}
'@
function ProcessRow([int]$Number,[bool]$Command=$true) {
 $p=[Diagnostics.Process]::GetProcessById($Number)
 if(-not $Command){
  $row=@{pid=$Number;name=($p.ProcessName+'.exe')}
  try{$row.parent=[AwNativeProcess]::Parent($Number)}catch{$row.parent=0;$row.parentError=[string]$_}
  try{$row.created=$p.StartTime.ToUniversalTime().ToString('o')}catch{$row.creationReadable=$false}
  return $row
 }
 $exact=$p.StartTime.ToUniversalTime();$micro=[DateTime]::new(($exact.Ticks-($exact.Ticks%10)),[DateTimeKind]::Utc)
 $row=@{pid=$Number;name=($p.ProcessName+'.exe');created=$micro.ToString('o');createdExact=$exact.ToString('o')}
 try{$row.parent=[AwNativeProcess]::Parent($Number)}catch{if($Command){throw};$row.parent=0;$row.parentError=[string]$_}
 if($Command){$row.commandLine=[AwNativeProcess]::Command($Number);$row.path=$p.MainModule.FileName}
 return $row
}
if($Mode -eq 'children') {
 $rows=@();foreach($p in [Diagnostics.Process]::GetProcesses()){try{if([AwNativeProcess]::Parent($p.Id)-eq $ProcessId){$rows+=ProcessRow $p.Id}}catch{}}
 ConvertTo-Json -InputObject $rows -Depth 4 -Compress
} elseif($Mode -eq 'ancestors') {
 $rows=@();$next=$ProcessId;for($i=0;$i -lt 6;$i++){try{$r=ProcessRow $next $false;$rows+=$r;$next=$r.parent;if($next -le 0){break}}catch{break}}
 ConvertTo-Json -InputObject $rows -Depth 4 -Compress
} else {
 try{[Diagnostics.Process]::GetProcessById($ProcessId)|Out-Null}catch [ArgumentException]{@{found=$false;pid=$ProcessId}|ConvertTo-Json -Compress;exit 0}
 $r=ProcessRow $ProcessId;$r.found=$true;$r|ConvertTo-Json -Compress
}
