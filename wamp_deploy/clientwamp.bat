@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Bar POS - Client reseau impression directe

REM ============================================================================
REM Bar POS (LogBara) - Client reseau WAMP avec impression directe Chrome/Edge
REM ============================================================================
REM - Lit l'IP du serveur (fichier serveur_ip.txt ou saisie manuelle)
REM - Si le client n'arrive pas a se connecter, propose de ressaisir l'IP
REM - Garde une URL simple : http://IP/barpos/
REM   Ne pas mettre le format Markdown [http://...](http://...).
REM - --kiosk-printing fonctionne seulement si le navigateur demarre avec ce
REM   flag. Le profil dedie ci-dessous ouvre une NOUVELLE SESSION separee :
REM   vos fenetres Chrome/Edge existantes ne sont PAS fermees.
REM   Seules les anciennes fenetres Bar POS de ce profil sont fermees.
REM ============================================================================

set "APP_FOLDER=barpos"
set "CONFIG_FILE=%~dp0serveur_ip.txt"
set "KIOSK_PROFILE=%LOCALAPPDATA%\LogBara\KioskProfile"

REM Fermeture automatique de la fenetre apres le lancement de l'application.
REM Mettre FERMER_AUTO=0 pour garder la fenetre ouverte (mode debug).
set "FERMER_AUTO=1"

echo.
echo ===========================================================================
echo                  Bar POS - Demarrage CLIENT reseau
echo ===========================================================================
echo.

REM ============================================================
REM Lecture / saisie de l'IP serveur
REM ============================================================
set "SERVER_IP="

REM Lire le fichier de config s'il existe
if exist "%CONFIG_FILE%" (
    set /p SAVED_IP=<"%CONFIG_FILE%"
    set "SAVED_IP=!SAVED_IP: =!"
    if not "!SAVED_IP!"=="" (
        echo Adresse IP du serveur enregistree : !SAVED_IP!
        echo.
        choice /c OC /n /m "[O] Utiliser cette adresse  [C] Changer"
        echo.
        if errorlevel 2 goto :changer_ip
        if errorlevel 1 set "SERVER_IP=!SAVED_IP!" & goto :ip_ok
    )
)

:changer_ip
echo.
echo =============================================================
echo Entrez l'adresse IP du serveur Bar POS (WAMP).
echo Exemple : 192.168.88.12
echo Cette adresse est affichee au lancement du serveur et sur
echo la page de connexion de l'application.
echo =============================================================
echo.
set /p SERVER_IP="Adresse IP du serveur : "

if "!SERVER_IP!"=="" (
    echo Adresse IP invalide. Operation annulee.
    pause
    exit /b 1
)

REM Sauvegarder l'IP pour les prochains lancements
echo !SERVER_IP!>"%CONFIG_FILE%"
echo.
echo Adresse IP sauvegardee dans : %CONFIG_FILE%
echo.

:ip_ok
set "APP_URL=http://!SERVER_IP!/%APP_FOLDER%/"

echo ===========================================================================
echo    URL serveur : %APP_URL%
echo ===========================================================================
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
        echo        ATTENTION : Le serveur %APP_URL% ne repond pas.
        echo.
        echo        Verifiez que :
        echo        - Le serveur est allume et connecte au reseau
        echo        - WampServer est demarre sur le serveur (icone verte)
        echo        - L'adresse IP est correcte
        echo        - Le pare-feu ne bloque pas le port 80
        echo.
        choice /c RC /n /m "[R] Reessayer  [C] Changer l'IP"
        echo.
        if errorlevel 2 del "%CONFIG_FILE%" 2>nul & goto :changer_ip
        if errorlevel 1 goto :ip_ok
    ) else (
        echo        Serveur : OK
    )
) else (
    echo        Verification ignoree : curl.exe introuvable sur ce poste.
    echo        Tentative de connexion directe...
)
echo.

REM ============================================================
REM Fermeture anciennes fenetres Bar POS (profil dedie)
REM ============================================================
echo [2/3] Fermeture des anciennes fenetres Bar POS ^(profil dedie uniquement^)...
echo        Vos autres fenetres Chrome/Edge ne sont PAS touchees.
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' OR Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*%KIOSK_PROFILE%*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
)
echo.

REM ============================================================
REM Lancement du navigateur
REM ============================================================
echo [3/3] Ouverture d'une NOUVELLE session navigateur en impression directe...
call :open_browser "%APP_URL%"
if errorlevel 1 goto :erreur

echo.
echo ===========================================================================
echo    Bar POS est lance !
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
