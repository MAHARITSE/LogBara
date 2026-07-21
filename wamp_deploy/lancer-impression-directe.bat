@echo off
setlocal EnableExtensions
title Bar POS - Impression directe (nouvelle session)

REM ============================================================================
REM Bar POS (LogBara) - Lancement WAMP avec impression directe Chrome/Edge
REM ============================================================================
REM --kiosk-printing supprime l'apercu d'impression : le ticket part directement
REM sur l'imprimante Windows par defaut, sans boite de dialogue.
REM
REM Ce flag n'est pris en compte que si le navigateur DEMARRE avec lui.
REM Contrairement a un lancement classique, ce lanceur NE FERME PAS vos
REM fenetres Chrome/Edge existantes : il ouvre une NOUVELLE SESSION separee
REM grace a un profil navigateur dedie (--user-data-dir).
REM   - vos onglets, comptes et navigations personnelles restent ouverts ;
REM   - seules les anciennes fenetres Bar POS (profil dedie) sont fermees,
REM     pour garantir que l'impression silencieuse reste active.
REM ============================================================================

set "APP_URL=http://localhost/barpos/"
set "KIOSK_PROFILE=%LOCALAPPDATA%\LogBara\KioskProfile"

echo [1/3] Verification du serveur WAMP (%APP_URL%)...
where curl.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    curl.exe -fs -o nul -m 3 "%APP_URL%"
    if errorlevel 1 (
        echo.
        echo ATTENTION : %APP_URL% ne repond pas.
        echo Demarrez WampServer et attendez que l'icone devienne verte,
        echo puis relancez ce script ^(ou appuyez sur une touche pour continuer^).
        echo.
        pause
    ) else (
        echo        WAMP : OK
    )
) else (
    echo        Verification ignoree : curl.exe introuvable sur ce poste.
)

echo [2/3] Fermeture des anciennes fenetres Bar POS ^(profil dedie uniquement^)...
echo        Vos autres fenetres Chrome/Edge ne sont PAS touchees.
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' OR Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*%KIOSK_PROFILE%*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
)

echo [3/3] Ouverture d'une NOUVELLE session navigateur en impression directe...
call :open_browser "%APP_URL%"
if errorlevel 1 goto :erreur

echo.
echo Bar POS est lance dans une fenetre separee, impression directe activee.
echo Les tickets partent directement sur l'imprimante Windows par defaut.
echo Si l'apercu s'affiche encore, verifiez que l'imprimante par defaut n'est pas
echo "Microsoft Print to PDF".
echo.
echo Fermeture automatique du lanceur...
exit /b 0

:open_browser
set "URL=%~1"
set "CHROME_EXE="
set "EDGE_EXE="

REM Google Chrome - chemins standards Windows 64/32 bits
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if defined CHROME_EXE (
    start "Bar POS - Chrome" "%CHROME_EXE%" --user-data-dir="%KIOSK_PROFILE%\Chrome" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --app="%URL%"
    exit /b 0
)

REM Chrome dans le PATH, si installe autrement
where chrome >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "Bar POS - Chrome" chrome --user-data-dir="%KIOSK_PROFILE%\Chrome" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --app="%URL%"
    exit /b 0
)

REM Microsoft Edge - present par defaut sur Windows 10/11
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if defined EDGE_EXE (
    echo Chrome introuvable. Tentative avec Microsoft Edge...
    start "Bar POS - Edge" "%EDGE_EXE%" --user-data-dir="%KIOSK_PROFILE%\Edge" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --app="%URL%"
    exit /b 0
)

where msedge >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Chrome introuvable. Tentative avec Microsoft Edge...
    start "Bar POS - Edge" msedge --user-data-dir="%KIOSK_PROFILE%\Edge" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --app="%URL%"
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
