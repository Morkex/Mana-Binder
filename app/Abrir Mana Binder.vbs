' Launches Mana Binder (Vite + Electron).
Option Explicit
Dim sh, fso, appDir
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = appDir
' /k keeps the console open on error; /c closes when done — use /c with electron:dev
sh.Run "cmd.exe /c npm.cmd run electron:dev", 1, False
