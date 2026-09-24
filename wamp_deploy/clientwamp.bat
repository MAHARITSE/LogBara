@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Bar POS - Lanceur WAMP (Reseau & Local)

REM ============================================================================
REM Bar POS (LogBara) - Lanceur client WAMP intelligent
REM - Auto-detection en local (localhost) ou sur reseau local (WiFi / Ethernet)
REM - Impression thermique directe sans fenetre parasite (--kiosk-printing)
REM - Compatible avec tous les navigateurs (Chrome, Edge, Brave ou defaut)
REM ============================================================================

set "CONFIG_DIR=%LOCALAPPDATA%\LogBara"
set "IP_FILE=%CONFIG_DIR%\server_ip.txt"
set "KIOSK_PROFILE=%CONFIG_DIR%\KioskProfile"
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%" >nul 2>&1

REM Reinitialisation manuelle de l'IP si demande via --reset ou -c
if /i "%~1"=="--reset" (
    if exist "%IP_FILE%" del /f /q "%IP_FILE%" >nul 2>&1
    echo Configuration de l'IP reinitialisee.
    echo.
)
if /i "%~1"=="-c" (
    if exist "%IP_FILE%" del /f /q "%IP_FILE%" >nul 2>&1
    echo Configuration de l'IP reinitialisee.
    echo.
)

echo ============================================================================
echo   Bar POS - Connexion au serveur WAMP
echo ============================================================================
echo.

set "SERVER_HOST="
set "OUT_FILE=%TEMP%\barpos_detected_ip_%RANDOM%.txt"
if exist "%OUT_FILE%" del /f /q "%OUT_FILE%" >nul 2>&1

REM ----------------------------------------------------------------------------
REM 1. RECHERCHE ET EXECUTION DU SCRIPT DE DETECTION POWERSHELL
REM ----------------------------------------------------------------------------
set "PS_SCRIPT=%~dp0detect_server.ps1"
if not exist "%PS_SCRIPT%" (
    set "PS_SCRIPT=%TEMP%\barpos_detect_tmp.ps1"
    (
        echo param^([string]$savedIpFile = ""^)
        echo [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
        echo function Test-BarPos^([string]$hostOrIp^) {
        echo     if ^([string]::IsNullOrWhiteSpace^($hostOrIp^)^) { return $false }
        echo     $h = $hostOrIp.Trim^(^)
        echo     try {
        echo         $tcp = New-Object System.Net.Sockets.TcpClient
        echo         $iar = $tcp.BeginConnect^($h, 80, $null, $null^)
        echo         if ^(-not $iar.AsyncWaitHandle.WaitOne^(250, $false^) -or -not $tcp.Connected^) {
        echo             $tcp.Close^(^)
        echo             return $false
        echo         }
        echo         $tcp.EndConnect^($iar^)
        echo         $tcp.Close^(^)
        echo     } catch { return $false }
        echo     $url = "http://$h/barpos/"
        echo     try {
        echo         $req = [System.Net.HttpWebRequest]::Create^($url^)
        echo         $req.Timeout = 1500
        echo         $req.Method = "HEAD"
        echo         $req.AllowAutoRedirect = $true
        echo         $res = $req.GetResponse^(^)
        echo         $code = [int]$res.StatusCode
        echo         $res.Close^(^)
        echo         if ^($code -ge 200 -and $code -lt 400^) { return $true }
        echo     } catch {
        echo         try {
        echo             $req2 = [System.Net.HttpWebRequest]::Create^($url^)
        echo             $req2.Timeout = 1800
        echo             $req2.Method = "GET"
        echo             $res2 = $req2.GetResponse^(^)
        echo             $code2 = [int]$res2.StatusCode
        echo             $res2.Close^(^)
        echo             if ^($code2 -ge 200 -and $code2 -lt 400^) { return $true }
        echo         } catch {}
        echo     }
        echo     return $false
        echo }
        echo if ^(Test-BarPos "localhost"^) { Write-Output "localhost"; exit 0 }
        echo if ^(Test-BarPos "127.0.0.1"^) { Write-Output "127.0.0.1"; exit 0 }
        echo if ^($savedIpFile -and ^(Test-Path $savedIpFile^)^) {
        echo     try {
        echo         $saved = ^(Get-Content $savedIpFile -Raw -ErrorAction SilentlyContinue^)
        echo         if ^($saved^) { $saved = $saved.Trim^(^); if ^($saved -and ^(Test-BarPos $saved^)^) { Write-Output $saved; exit 0 } }
        echo     } catch {}
        echo }
        echo $candidates = [System.Collections.Generic.List[string]]::new^(^)
        echo try {
        echo     $routes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue
        echo     foreach ^($r in $routes^) { if ^($r.NextHop -and $r.NextHop -ne '0.0.0.0'^) { if ^(-not $candidates.Contains^($r.NextHop^)^) { $candidates.Add^($r.NextHop^) } } }
        echo } catch {}
        echo try {
        echo     $arp = arp -a
        echo     $matches = [regex]::Matches^($arp, '\b(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b'^)
        echo     foreach ^($m in $matches^) { $ip = $m.Value; if ^(-not $ip.EndsWith^('.255'^) -and -not $ip.EndsWith^('.0'^) -and -not $ip.StartsWith^('127.'^)^) { if ^(-not $candidates.Contains^($ip^)^) { $candidates.Add^($ip^) } } }
        echo } catch {}
        echo try {
        echo     $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }
        echo     foreach ^($a in $addrs^) {
        echo         $parts = $a.IPAddress.Split^('.'^)
        echo         if ^($parts.Length -eq 4^) {
        echo             $prefix = "$^($parts[0]^).$^($parts[1]^).$^($parts[2]^)."
        echo             if ^(-not $candidates.Contains^($a.IPAddress^)^) { $candidates.Add^($a.IPAddress^) }
        echo             foreach ^($suffix in @^(1, 50, 2, 10, 100, 20, 200, 150, 43, 254^)^) {
        echo                 $testIp = "$prefix$suffix"
        echo                 if ^(-not $candidates.Contains^($testIp^)^) { $candidates.Add^($testIp^) }
        echo             }
        echo         }
        echo     }
        echo } catch {}
        echo foreach ^($ip in $candidates^) { if ^(Test-BarPos $ip^) { Write-Output $ip; exit 0 } }
        echo exit 1
    ) > "%PS_SCRIPT%"
)

echo [1/3] Recherche du serveur WAMP (local ou reseau)...
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" "%IP_FILE%" > "%OUT_FILE%" 2>nul
    if exist "%OUT_FILE%" (
        set /p DETECTED_IP=<"%OUT_FILE%"
        del /f /q "%OUT_FILE%" >nul 2>&1
    )
)

if defined DETECTED_IP (
    set "DETECTED_IP=!DETECTED_IP: =!"
    if defined DETECTED_IP (
        set "SERVER_HOST=!DETECTED_IP!"
        echo        -> Serveur detecte avec succes : !SERVER_HOST! !
        echo !SERVER_HOST!>"%IP_FILE%" 2>nul
        goto :lancer
    )
)

REM ----------------------------------------------------------------------------
REM 2. SAISIE MANUELLE SI AUCUN SERVEUR AUTOMATIQUE TROUVE
REM ----------------------------------------------------------------------------
:saisie_ip
echo.
echo ============================================================================
echo   Configuration manuelle de l'adresse IP du serveur WAMP
echo ============================================================================
echo Aucune reponse automatique sur le reseau.
echo Adresses reseau de ce poste :
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host '   - ' $_.InterfaceAlias ': ' $_.IPAddress }" 2>nul
) else (
    ipconfig | findstr /i "IPv4"
)
echo.
echo Entrez l'adresse IP du serveur WAMP (ou 'localhost' si vous etes sur le serveur) :
echo Exemple : 192.168.1.50   ou   localhost
echo.
set "USER_IP="
set /p USER_IP="Adresse IP du serveur : "

if not defined USER_IP goto :saisie_ip
set "USER_IP=!USER_IP: =!"
set "USER_IP=!USER_IP:http://=!"
set "USER_IP=!USER_IP:https://=!"
set "USER_IP=!USER_IP:/barpos/=!"
set "USER_IP=!USER_IP:/barpos=!"
set "USER_IP=!USER_IP:/=!"

if not defined USER_IP goto :saisie_ip
set "SERVER_HOST=!USER_IP!"
echo !SERVER_HOST!>"%IP_FILE%" 2>nul

REM ----------------------------------------------------------------------------
REM 3. DETECTION DU NAVIGATEUR ET LANCEMENT DE L'APPLICATION
REM ----------------------------------------------------------------------------
:lancer
set "APP_URL=http://!SERVER_HOST!/barpos/"
echo.
echo [2/3] Preparation de l'application sur : !APP_URL!

set "BROWSER_EXE="

REM Verification Google Chrome (Tous emplacements Windows)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

REM Verification Microsoft Edge
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

REM Verification dans le PATH Windows
if not defined BROWSER_EXE (
    where chrome.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "BROWSER_EXE=chrome.exe"
)
if not defined BROWSER_EXE (
    where msedge.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "BROWSER_EXE=msedge.exe"
)

echo [3/3] Ouverture de Bar POS...
if defined BROWSER_EXE (
    echo        Navigateur utilise : !BROWSER_EXE!
    start "" "!BROWSER_EXE!" --user-data-dir="%KIOSK_PROFILE%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --app="!APP_URL!"
) else (
    echo        Ouverture avec le navigateur par defaut de Windows...
    start "" "!APP_URL!"
)

echo.
echo ============================================================================
echo   Bar POS est en cours d'execution !
echo   Pour reconfigurer l'adresse IP une prochaine fois :
echo   clientwamp.bat --reset
echo ============================================================================
echo.
timeout /t 3 >nul 2>&1
exit /b 0
