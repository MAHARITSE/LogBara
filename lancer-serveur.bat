@echo off
setlocal EnableExtensions EnableDelayedExpansion
title LogBara - Serveur

REM ============================================================================
REM LogBara - Lanceur SERVEUR (poste ou WAMP est installe)
REM ============================================================================
REM - Detecte automatiquement l'adresse IP reseau du serveur
REM - Affiche l'URL a communiquer aux clients : http://IP/barpos/
REM - Lance l'application sur le serveur en impression directe
REM ============================================================================

set "APP_URL=http://localhost/barpos/"
set "APP_FOLDER=barpos"
set "KIOSK_PROFILE=%LOCALAPPDATA%\LogBara\KioskProfile"

REM Fermeture automatique de la fenetre apres le lancement de l'application.
REM Mettre FERMER_AUTO=0 pour garder la fenetre ouverte (mode debug).
set "FERMER_AUTO=1"

echo.
echo ===========================================================================
echo                        LogBara - Demarrage SERVEUR
echo ===========================================================================
echo.

REM ============================================================
REM Detection de l'adresse IP reseau du serveur
REM ============================================================
echo [1/4] Detection de l'adresse IP du serveur...
echo.

set "SERVER_IP="

REM Essai 1 : PowerShell (le plus fiable)
where powershell.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command ^
        "$ips = Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^127\.' -and $_.PrefixOrigin -ne 'WellKnown' } ^| Sort-Object -Property InterfaceMetric ^| Select-Object -First 1 -ExpandProperty IPAddress; if (-not $ips) { $ips = (Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.InterfaceAlias -notmatch 'Loopback' } ^| Select-Object -First 1 -ExpandProperty IPAddress) }; $ips"`) do (
        set "SERVER_IP=%%a"
    )
)

REM Essai 2 : ipconfig (fallback)
if "!SERVER_IP!"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
        set "TEMP_IP=%%a"
        set "TEMP_IP=!TEMP_IP: =!"
        if not "!TEMP_IP!"=="" if "!SERVER_IP!"=="" set "SERVER_IP=!TEMP_IP!"
    )
)

REM Essai 3 : route print (dernier recours)
if "!SERVER_IP!"=="" (
    for /f "tokens=4 delims= " %%a in ('route print ^| findstr " 0.0.0.0.*0.0.0.0"') do (
        set "SERVER_IP=%%a"
    )
)

if "!SERVER_IP!"=="" set "SERVER_IP=192.168.1.100"

echo        Adresse IP detectee : !SERVER_IP!
echo.

REM ============================================================
REM Affichage des URLs
REM ============================================================
echo ===========================================================================
echo.
echo    Serveur local  : %APP_URL%
echo    Reseau clients : http://!SERVER_IP!/%APP_FOLDER%/
echo.
echo    Les clients doivent utiliser l'URL reseau ci-dessus
echo    dans leur lanceur client (lancer-client.bat).
echo.
echo ===========================================================================
echo.

REM ============================================================
REM Verification WAMP
REM ============================================================
echo [2/4] Verification du serveur WAMP (%APP_URL%)...
where curl.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    curl.exe -fs -o nul -m 3 "%APP_URL%"
    if errorlevel 1 (
        echo.
        echo        ATTENTION : %APP_URL% ne repond pas.
        echo        Demarrez WampServer et attendez que l'icone devienne verte,
        echo        puis relancez ce script.
        echo.
        pause
        exit /b 1
    ) else (
        echo        WAMP : OK
    )
) else (
    echo        Verification ignoree : curl.exe introuvable sur ce poste.
)
echo.

REM ============================================================
REM Fermeture anciennes fenetres Bar POS (profil dedie)
REM ============================================================
echo [3/4] Fermeture des anciennes fenetres LogBara...
echo        (vos autres fenetres Chrome/Edge ne sont pas touchees)
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' OR Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*%KIOSK_PROFILE%*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
)
echo.

REM ============================================================
REM Lancement du navigateur
REM ============================================================
echo [4/4] Ouverture de LogBara en impression directe...
call :open_browser "%APP_URL%"
if errorlevel 1 goto :erreur

echo.
echo ===========================================================================
echo    LogBara est lance !
echo.
echo    URL a communiquer aux clients :
echo    http://!SERVER_IP!/%APP_FOLDER%/
echo.
echo    Les tickets partent directement sur l'imprimante par defaut.
echo ===========================================================================
echo.
if "%FERMER_AUTO%"=="1" exit /b 0
pause
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
