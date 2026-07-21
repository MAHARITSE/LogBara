@echo off
setlocal EnableExtensions EnableDelayedExpansion
title LogBara - Client

REM ============================================================================
REM LogBara - Lanceur CLIENT (poste distant, sans WAMP)
REM ============================================================================
REM - Verifie la connexion reseau vers le serveur
REM - Verifie la connexion reseau vers le serveur
REM - Lance l'application en impression directe
REM ============================================================================

set "APP_FOLDER=LogBara"
set "KIOSK_PROFILE=%LOCALAPPDATA%\LogBara\KioskProfile"

set "APP_URL=http://localhost/%APP_FOLDER%/"

echo.
echo ===========================================================================
echo                      LogBara - Demarrage CLIENT
echo ===========================================================================
echo.
echo         Developpe par MAHARITSE Hiacinthe Bertrand
echo         📞 038 34 092 61
echo.
echo         Si le serveur est inaccessible :
        echo         - Verifiez que WampServer est en marche (icone VERTE)
echo.

REM ============================================================
REM Verification du serveur
REM ============================================================
echo [1/3] Verification de la connexion au serveur...
where curl.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    curl.exe -fs -o nul -m 5 "%APP_URL%"
    if errorlevel 1 (
        echo.
        echo    ATTENTION : %APP_URL% ne repond pas.
        echo.
        echo    Verifiez que WampServer est demarre (icone VERTE).
    ) else (
        echo        Serveur : OK
    )
) else (
    echo        Verification ignoree : curl.exe introuvable.
    echo        Tentative de connexion directe...
)
echo.

REM ============================================================
REM Fermeture anciennes fenetres LogBara (profil dedie)
REM ============================================================
echo [2/3] Fermeture des anciennes fenetres LogBara...
echo        (vos autres fenetres Chrome/Edge ne sont pas touchees)
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' OR Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*%KIOSK_PROFILE%*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
)
echo.

REM ============================================================
REM Lancement du navigateur
REM ============================================================
echo [3/3] Ouverture de LogBara en impression directe...
call :open_browser "%APP_URL%"
if errorlevel 1 goto :erreur

echo.
echo ===========================================================================
echo     LogBara est lance !
echo     Les tickets partent directement sur l'imprimante par defaut.
echo ===========================================================================
echo.
exit /b 0

:open_browser
set "URL=%~1"
set "CHROME_EXE="
set "EDGE_EXE="

REM Google Chrome - chemins standards Windows 64/32 bits
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if defined CHROME_EXE (
    start "LogBara - Chrome" "%CHROME_EXE%" --user-data-dir="%KIOSK_PROFILE%\Chrome" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --app="%URL%"
    exit /b 0
)

REM Chrome dans le PATH
where chrome >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "LogBara - Chrome" chrome --user-data-dir="%KIOSK_PROFILE%\Chrome" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --app="%URL%"
    exit /b 0
)

REM Microsoft Edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if defined EDGE_EXE (
    echo Chrome introuvable. Tentative avec Microsoft Edge...
    start "LogBara - Edge" "%EDGE_EXE%" --user-data-dir="%KIOSK_PROFILE%\Edge" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --app="%URL%"
    exit /b 0
)

where msedge >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Chrome introuvable. Tentative avec Microsoft Edge...
    start "LogBara - Edge" msedge --user-data-dir="%KIOSK_PROFILE%\Edge" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --app="%URL%"
    exit /b 0
)

exit /b 1

:erreur
echo.
echo ERREUR : Aucun navigateur Chrome/Edge compatible n'a ete trouve.
echo Installez Google Chrome ou utilisez Microsoft Edge.
echo.
pause
exit /b 1
