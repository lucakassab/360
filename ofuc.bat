@echo off
setlocal ENABLEDELAYEDEXPANSION

:: Define o diretório base como o diretório atual
set "BASE_DIR=%cd%"

echo Ofuscando todos os arquivos JS em: %BASE_DIR%
echo.

:: Percorre todos os arquivos .js em subpastas
for /R "%BASE_DIR%" %%F in (*.js) do (
    echo Ofuscando: %%F

    :: Chama o obfuscador sobrescrevendo o mesmo arquivo
    javascript-obfuscator "%%F" --output "%%F" --compact true --control-flow-flattening true --string-array true --string-array-encoding base64
)

echo.
echo ✅ Todos os arquivos foram ofuscados e sobrescritos.
pause
