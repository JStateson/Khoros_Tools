@echo off

set SRC=C:\Users\josep\source\repos\Khoros_Tools
set OUT=%SRC%\Release

rmdir /s /q "%OUT%"
mkdir "%OUT%"

robocopy "%SRC%" "%OUT%" *.js *.json *.html *.png *.md /NJH /NJS /NFL /NDL

tar -a -c -f "%SRC%\Khoros_Tools.zip" -C "%OUT%" .
rmdir /s /q "%OUT%"