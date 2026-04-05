' hello-world.vbs – Mini Scratch VBScript starter
' VBScript runs in Internet Explorer / Windows Script Host (wscript/cscript).
' In Mini Scratch it is treated as a text file you can view and edit.

Option Explicit

' ── Variables ──────────────────────────────────────────────────────────────
Dim strName
Dim intCount
Dim arrFruits(2)

strName  = "Mini Scratch"
intCount = 0

' ── Greet ──────────────────────────────────────────────────────────────────
Sub Greet(name)
    MsgBox "Hello, " & name & "! 👋", vbInformation, "Hello World"
End Sub

' ── Count to five ──────────────────────────────────────────────────────────
Sub CountToFive()
    Dim i
    For i = 1 To 5
        intCount = intCount + 1
        WScript.Echo "Count: " & i
    Next
End Sub

' ── Fruit list ─────────────────────────────────────────────────────────────
Sub ShowFruits()
    arrFruits(0) = "Apple"
    arrFruits(1) = "Banana"
    arrFruits(2) = "Orange"

    Dim i
    For i = 0 To UBound(arrFruits)
        WScript.Echo (i + 1) & ". " & arrFruits(i)
    Next
End Sub

' ── Entry point ────────────────────────────────────────────────────────────
Call Greet(strName)
Call CountToFive()
Call ShowFruits()

WScript.Echo "Done! Total count: " & intCount
