' Starts the KGiSL smart-board helper with no window. Used by the Windows start-up shortcut that
' install-autostart.ps1 creates, so the helper is already running when the faculty opens the site.
' Output goes to helper.log next to this file.
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
helperDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = helperDir
shell.Run "cmd /c node src\index.js >> helper.log 2>&1", 0, False
