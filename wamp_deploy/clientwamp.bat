@echo off
REM ============================================================================
REM Bar POS (LogBara) - Lanceur universel unique (clientwamp.bat)
REM - Detecte automatiquement si le serveur WAMP tourne en local (localhost)
REM   ou sur le reseau (Wi-Fi, Ethernet, Hotspot)
REM - Gere la memorisation de l'IP du serveur et le lancement de
REM   Chrome/Edge avec --kiosk-printing (impression directe)
REM - Option --dialogue (alias -d) : lance SANS --kiosk-printing pour
REM   ouvrir la fenetre de choix de l'imprimante a chaque ticket
REM
REM IMPORTANT : ce fichier doit rester en fins de ligne Windows (CRLF) et en
REM ASCII pur (pas d'accents). Voir .gitattributes.
REM ============================================================================

REM ----------------------------------------------------------------------------
REM 0. GARDE-FOU : relance le script dans un sous-processus pour que la fenetre
REM    reste ouverte et affiche l'erreur si quelque chose se passe mal
REM    (au lieu de se fermer immediatement apres un double-clic).
REM ----------------------------------------------------------------------------
if /i not "%~1"=="__barpos_run__" (
    cmd /d /c ""%~f0" __barpos_run__ %*"
    if errorlevel 1 (
        echo.
        echo ============================================================================
        echo   Une erreur est survenue lors du lancement de Bar POS.
        echo   Lisez le message ci-dessus, puis appuyez sur une touche pour fermer.
        echo ============================================================================
        pause >nul
    )
    exit /b
)
shift

setlocal EnableExtensions EnableDelayedExpansion
title Bar POS - Lanceur WAMP (Reseau et Local)

set "CONFIG_DIR=%LOCALAPPDATA%\LogBara"
set "IP_FILE=%CONFIG_DIR%\server_ip.txt"
set "KIOSK_PROFILE=%CONFIG_DIR%\KioskProfile"
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%" >nul 2>&1

REM Reinitialisation manuelle de l'IP si demande via --reset ou -c
set "DO_RESET="
if /i "%~1"=="--reset" set "DO_RESET=1"
if /i "%~1"=="-c" set "DO_RESET=1"

REM Mode "choix de l'imprimante" : --dialogue (alias -d ou --choix)
REM lance le navigateur SANS --kiosk-printing : a chaque ticket, la
REM fenetre d'impression s'ouvre pour choisir l'imprimante.
set "PRINT_DIALOG="
if /i "%~1"=="--dialogue" set "PRINT_DIALOG=1"
if /i "%~1"=="--choix" set "PRINT_DIALOG=1"
if /i "%~1"=="-d" set "PRINT_DIALOG=1"
if defined DO_RESET (
    if exist "%IP_FILE%" del /f /q "%IP_FILE%" >nul 2>&1
    echo Configuration de l'IP reinitialisee.
    echo.
)

echo ============================================================================
echo   Bar POS - Connexion au serveur WAMP
echo ============================================================================
echo.

set "SERVER_HOST="
set "DETECTED_IP="
set "TMP_PS="
set "OUT_FILE=%TEMP%\barpos_detected_ip_%RANDOM%.txt"
if exist "%OUT_FILE%" del /f /q "%OUT_FILE%" >nul 2>&1

REM Localisation de PowerShell (meme s'il n'est pas dans le PATH)
set "PS_EXE="
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not defined PS_EXE (
    where powershell.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "PS_EXE=powershell.exe"
)

REM ----------------------------------------------------------------------------
REM 1. RECHERCHE ET EXECUTION DU SCRIPT DE DETECTION POWERSHELL
REM    - utilise detect_server.ps1 s'il est a cote de ce fichier
REM    - sinon, extrait le script integre a la fin de ce fichier (le .bat peut
REM      donc etre copie seul sur les postes clients)
REM ----------------------------------------------------------------------------
echo [1/3] Recherche du serveur WAMP (local ou reseau)...
if not defined PS_EXE goto :saisie_ip

set "PS_SCRIPT=%~dp0detect_server.ps1"
if exist "%PS_SCRIPT%" goto :run_detection

set "BARPOS_SELF=%~f0"
set "PS_SCRIPT=%TEMP%\barpos_detect_%RANDOM%.ps1"
set "TMP_PS=1"
"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:BARPOS_SELF); $m='#BARPOS'+'_PS_BEGIN'; $i=$t.IndexOf($m); if ($i -lt 0) { exit 1 }; [IO.File]::WriteAllText($env:PS_SCRIPT, $t.Substring($i+$m.Length))" >nul 2>&1
if not exist "%PS_SCRIPT%" goto :saisie_ip

:run_detection
"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" "%IP_FILE%" > "%OUT_FILE%" 2>nul
if exist "%OUT_FILE%" (
    set /p DETECTED_IP=<"%OUT_FILE%"
    del /f /q "%OUT_FILE%" >nul 2>&1
)
if defined TMP_PS if exist "%PS_SCRIPT%" del /f /q "%PS_SCRIPT%" >nul 2>&1

if not defined DETECTED_IP goto :saisie_ip
set "DETECTED_IP=!DETECTED_IP: =!"
if not defined DETECTED_IP goto :saisie_ip

set "SERVER_HOST=!DETECTED_IP!"
echo        OK : serveur detecte a l'adresse !SERVER_HOST!
>"%IP_FILE%" echo !SERVER_HOST!
goto :lancer

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
if defined PS_EXE (
    "%PS_EXE%" -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host ('   - ' + $_.InterfaceAlias + ' : ' + $_.IPAddress) }" 2>nul
) else (
    ipconfig | findstr /i "IPv4"
)
echo.
echo Entrez l'adresse IP du serveur WAMP, ou localhost si vous etes sur le serveur.
echo Exemple : 192.168.1.50   ou   localhost
echo.
set "USER_IP="
set /p "USER_IP=Adresse IP du serveur : "

if not defined USER_IP goto :saisie_ip
set "USER_IP=!USER_IP: =!"
set "USER_IP=!USER_IP:http://=!"
set "USER_IP=!USER_IP:https://=!"
set "USER_IP=!USER_IP:/logbara/=!"
set "USER_IP=!USER_IP:/logbara=!"
set "USER_IP=!USER_IP:/barpos/=!"
set "USER_IP=!USER_IP:/barpos=!"
set "USER_IP=!USER_IP:/=!"

if not defined USER_IP goto :saisie_ip
set "SERVER_HOST=!USER_IP!"
>"%IP_FILE%" echo !SERVER_HOST!

REM ----------------------------------------------------------------------------
REM 3. DETECTION DU NAVIGATEUR ET LANCEMENT DE L'APPLICATION
REM ----------------------------------------------------------------------------
:lancer
set "APP_URL=http://!SERVER_HOST!/logbara/"
echo.
echo [2/3] Preparation de l'application sur : !APP_URL!

set "BROWSER_EXE="

REM Google Chrome (tous emplacements Windows)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

REM Microsoft Edge
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

REM Navigateur present dans le PATH Windows
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
    REM Fenetre d'application distincte, plein ecran, profil dedie pour ne pas
    REM reutiliser une fenetre deja ouverte du navigateur.
    if defined PRINT_DIALOG (
        echo        Mode choix d'imprimante : fenetre d'impression a chaque ticket.
        start "Bar POS" "!BROWSER_EXE!" --user-data-dir="%KIOSK_PROFILE%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --new-window --start-fullscreen --app="!APP_URL!"
    ) else (
        start "Bar POS" "!BROWSER_EXE!" --user-data-dir="%KIOSK_PROFILE%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --new-window --start-fullscreen --app="!APP_URL!"
    )
) else (
    echo        Ouverture avec le navigateur par defaut de Windows...
    start "" "!APP_URL!"
)

echo.
echo ============================================================================
echo   Bar POS est en cours d'execution !
echo   Pour reconfigurer l'adresse IP une prochaine fois :
echo   clientwamp.bat --reset
echo   Pour ouvrir la fenetre de choix de l'imprimante a chaque ticket :
echo   clientwamp.bat --dialogue
echo ============================================================================
echo.
timeout /t 3 >nul 2>&1
exit /b 0

REM ============================================================================
REM Tout ce qui suit n'est JAMAIS execute par cmd.exe (le script s'arrete au
REM "exit /b" ci-dessus). C'est le script PowerShell de detection integre,
REM extrait dans %TEMP% quand detect_server.ps1 est absent.
REM ============================================================================
#BARPOS_PS_BEGIN
param([string]$savedIpFile = "")

function Test-BarPos([string]$hostOrIp) {
    if ([string]::IsNullOrWhiteSpace($hostOrIp)) { return $false }
    $h = $hostOrIp.Trim()
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect($h, 80, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(250, $false) -or -not $tcp.Connected) {
            $tcp.Close()
            return $false
        }
        $tcp.EndConnect($iar)
        $tcp.Close()
    } catch { return $false }

    foreach ($appPath in @("logbara", "barpos")) {
        try {
            $apiUrl = "http://$h/$appPath/api/index.php"
            $reqApi = [System.Net.HttpWebRequest]::Create($apiUrl)
            $reqApi.Timeout = 1500
            $reqApi.Method = "GET"
            $reqApi.Headers.Add("X-BarPOS-Request", "1")
            $resApi = $reqApi.GetResponse()
            $stream = $resApi.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            $reader.Close()
            $resApi.Close()
            if ($content -match "Starlink" -or $content -match "starlink") { return $false }
            if ($content -match "<response" -or $content -match "barpos" -or $content -match "Bar POS" -or $content -match "LogBara" -or $content -match "logbara") { return $true }
        } catch {}

        try {
            $url = "http://$h/$appPath/"
            $req = [System.Net.HttpWebRequest]::Create($url)
            $req.Timeout = 1500
            $req.Method = "GET"
            $req.AllowAutoRedirect = $true
            $res = $req.GetResponse()
            $stream = $res.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $html = $reader.ReadToEnd()
            $reader.Close()
            $res.Close()
            if ($html -match "Starlink" -or $html -match "starlink") { return $false }
            if ($html -match "Bar POS" -or $html -match "barpos" -or $html -match "Point de Vente" -or $html -match "LogBara" -or $html -match "logbara") { return $true }
        } catch {}
    }
    return $false
}

if (Test-BarPos "localhost") { Write-Output "localhost"; exit 0 }
if (Test-BarPos "127.0.0.1") { Write-Output "127.0.0.1"; exit 0 }

if ($savedIpFile -and (Test-Path -LiteralPath $savedIpFile)) {
    try {
        $saved = Get-Content -LiteralPath $savedIpFile -Raw -ErrorAction SilentlyContinue
        if ($saved) {
            $saved = $saved.Trim()
            if ($saved -and (Test-BarPos $saved)) { Write-Output $saved; exit 0 }
        }
    } catch {}
}

$candidates = New-Object System.Collections.Generic.List[string]

try {
    $routes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue
    foreach ($r in $routes) {
        if ($r.NextHop -and $r.NextHop -ne '0.0.0.0' -and -not $candidates.Contains($r.NextHop)) { $candidates.Add($r.NextHop) }
    }
} catch {}

try {
    $arpText = (arp -a) -join "`n"
    $found = [regex]::Matches($arpText, '\b(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b')
    foreach ($m in $found) {
        $ip = $m.Value
        if (-not $ip.EndsWith('.255') -and -not $ip.EndsWith('.0') -and -not $candidates.Contains($ip)) { $candidates.Add($ip) }
    }
} catch {}

try {
    $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }
    foreach ($a in $addrs) {
        $parts = $a.IPAddress.Split('.')
        if ($parts.Length -eq 4) {
            $prefix = "$($parts[0]).$($parts[1]).$($parts[2])."
            if (-not $candidates.Contains($a.IPAddress)) { $candidates.Add($a.IPAddress) }
            foreach ($suffix in @(1, 50, 2, 10, 100, 20, 200, 150, 43, 254)) {
                $testIp = "$prefix$suffix"
                if (-not $candidates.Contains($testIp)) { $candidates.Add($testIp) }
            }
        }
    }
} catch {}

foreach ($ip in $candidates) {
    if (Test-BarPos $ip) { Write-Output $ip; exit 0 }
}
exit 1
