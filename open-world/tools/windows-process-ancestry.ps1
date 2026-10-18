param([Parameter(Mandatory=$true)][int]$ProcessId)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class NativeProcessTree {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct Entry {
  public uint size, usage, pid; public UIntPtr heap; public uint module, threads, parent; public int priority; public uint flags;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)] public string name;
 }
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,EntryPoint="Process32FirstW")] static extern bool First(IntPtr snapshot,ref Entry entry);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,EntryPoint="Process32NextW")] static extern bool Next(IntPtr snapshot,ref Entry entry);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 public static Entry[] Ancestors(uint pid){
  var handle=CreateToolhelp32Snapshot(2,0); if(handle==new IntPtr(-1))throw new System.ComponentModel.Win32Exception();
  try { var all=new Dictionary<uint,Entry>();var entry=new Entry();entry.size=(uint)Marshal.SizeOf(typeof(Entry));
   if(First(handle,ref entry)){do{all[entry.pid]=entry;}while(Next(handle,ref entry));}
   var rows=new List<Entry>();for(int i=0;i<4&&all.ContainsKey(pid);i++){var row=all[pid];rows.Add(row);pid=row.parent;}return rows.ToArray();
  } finally {CloseHandle(handle);}
 }
}
"@
$rows=@([NativeProcessTree]::Ancestors([uint32]$ProcessId) | ForEach-Object { @{pid=$_.pid;parent=$_.parent;name=$_.name} })
ConvertTo-Json -InputObject $rows -Compress
