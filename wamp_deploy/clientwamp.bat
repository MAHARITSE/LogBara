@echo off
REM ============================================================================
REM Bar POS (LogBara) - Lanceur Unique Universel (clientwamp.bat)
REM ============================================================================
REM - UN SEUL BOUTON pour tout gerer :
REM   * Detecte automatiquement le serveur WAMP (localhost ou reseau local)
REM   * Configure l'imprimante thermique 80mm par defaut pour le mode kiosque
REM   * Lance directement l'application en plein ecran sans dialogue d'impression
REM - Raccourcis clavier au demarrage rapide (2s) :
REM   * [Entree] ou attente : Lancement immediat
REM   * [P] ou [2] : Choisir l'imprimante ticket 80mm
REM   * [S] ou [3] : Reconfigurer l'adresse IP du serveur
REM ============================================================================

REM ----------------------------------------------------------------------------
REM 0. GARDE-FOU : relance le script dans un sous-processus si double-clic
REM ----------------------------------------------------------------------------
if /i not "%~1"=="__barpos_run__" (
    cmd /d /c ""%~f0" __barpos_run__ %*"
    if errorlevel 1 (
        echo.
        echo ============================================================================
        echo   Une erreur est survenue lors du lancement de Bar POS.
        echo   Appuyez sur une touche pour fermer...
        echo ============================================================================
        pause >nul
    )
    exit /b
)
shift

setlocal EnableExtensions EnableDelayedExpansion
title Bar POS - Point de Vente (Mode Kiosque 80mm)

set "CONFIG_DIR=%LOCALAPPDATA%\LogBara"
set "IP_FILE=%CONFIG_DIR%\server_ip.txt"
set "PRINTER_FILE=%CONFIG_DIR%\printer_name.txt"
set "KIOSK_PROFILE=%CONFIG_DIR%\KioskProfile"
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%" >nul 2>&1

REM Localisation de PowerShell
set "PS_EXE="
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not defined PS_EXE (
    where powershell.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "PS_EXE=powershell.exe"
)

REM Preparation du script PowerShell de detection
set "PS_SCRIPT=%~dp0detect_server.ps1"
if not exist "%PS_SCRIPT%" (
    set "BARPOS_SELF=%~f0"
    set "PS_SCRIPT=%TEMP%\barpos_detect_%RANDOM%.ps1"
    set "TMP_PS=1"
    if defined PS_EXE (
        "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:BARPOS_SELF); $m='#BARPOS'+'_PS_BEGIN'; $i=$t.IndexOf($m); if ($i -lt 0) { exit 1 }; [IO.File]::WriteAllText($env:PS_SCRIPT, $t.Substring($i+$m.Length))" >nul 2>&1
    )
)

REM ----------------------------------------------------------------------------
REM OPTIONS EN LIGNE DE COMMANDE
REM ----------------------------------------------------------------------------
if /i "%~1"=="--imprimante" goto :action_select_printer
if /i "%~1"=="--printer" goto :action_select_printer
if /i "%~1"=="--choix-imprimante" goto :action_select_printer
if /i "%~1"=="-i" goto :action_select_printer
if /i "%~1"=="-p" goto :action_select_printer

if /i "%~1"=="--reset" goto :action_reset_ip
if /i "%~1"=="--reset-ip" goto :action_reset_ip
if /i "%~1"=="-c" goto :action_reset_ip

set "PRINT_DIALOG="
if /i "%~1"=="--dialogue" set "PRINT_DIALOG=1"
if /i "%~1"=="--choix" set "PRINT_DIALOG=1"
if /i "%~1"=="-d" set "PRINT_DIALOG=1"

REM ----------------------------------------------------------------------------
REM 1. DETECTION ULTRA-RAPIDE DU SERVEUR LOCAL (SERVEUR PC)
REM ----------------------------------------------------------------------------
set "LOCAL_SERVER_FOUND="

REM Test 1 : Apache est-il en cours d'execution localement ?
tasklist /fi "imagename eq httpd.exe" 2>nul | findstr /i "httpd.exe" >nul
if !ERRORLEVEL! EQU 0 set "LOCAL_SERVER_FOUND=1"

REM Test 2 : Port 80 en ecoute locale ?
if not defined LOCAL_SERVER_FOUND (
    netstat -ano 2>nul | findstr /r ":80 .*LISTENING" >nul
    if !ERRORLEVEL! EQU 0 set "LOCAL_SERVER_FOUND=1"
)

REM Test 3 : Dossier WAMP standard sur le poste ?
if not defined LOCAL_SERVER_FOUND (
    if exist "C:\wamp64\bin\apache" set "LOCAL_SERVER_FOUND=1"
    if exist "C:\wamp\bin\apache" set "LOCAL_SERVER_FOUND=1"
    if exist "%~dp0api\config.php" set "LOCAL_SERVER_FOUND=1"
)

REM ----------------------------------------------------------------------------
REM 2. AFFICHAGE DE L'ACCUEIL & MENU RAPIDE (UN SEUL BOUTON)
REM ----------------------------------------------------------------------------
:accueil_menu
cls
echo ============================================================================
echo   BAR POS - POINT DE VENTE (Mode Kiosque et Impression Directe 80mm)
echo ============================================================================
echo.

REM Afficher l'imprimante configuree
if defined PS_EXE (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -showPrinter 2>nul
) else (
    if exist "%PRINTER_FILE%" (
        set /p SAVED_PRINTER=<"%PRINTER_FILE%"
        echo   Imprimante ticket 80mm : !SAVED_PRINTER!
    )
)

if defined LOCAL_SERVER_FOUND (
    echo   Serveur WAMP           : localhost (Serveur local detecte)
) else (
    if exist "%IP_FILE%" (
        set /p SAVED_IP=<"%IP_FILE%"
        if defined SAVED_IP echo   Serveur WAMP           : !SAVED_IP!
    )
)
echo ============================================================================
echo.
echo   [Entree] Lancer Bar POS (Impression directe 80mm)
echo   [P]      Choisir l'imprimante ticket 80mm par defaut
echo   [S]      Reconfigurer l'adresse IP du serveur
echo.
echo   Demarrage automatique dans 2 secondes...
echo.

REM Attente 2 secondes avec choix rapide
choice /c 1PS /t 2 /d 1 /n >nul 2>&1
if errorlevel 3 goto :action_reset_ip
if errorlevel 2 goto :action_select_printer

goto :demarrer_app

REM ----------------------------------------------------------------------------
REM ACTION : CHOISIR L'IMPRIMANTE TICKET 80MM
REM ----------------------------------------------------------------------------
:action_select_printer
echo.
echo ============================================================================
echo   Configuration de l'imprimante ticket 80mm
echo ============================================================================
if defined PS_EXE (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -selectPrinter
) else (
    echo PowerShell n'est pas disponible pour lister les imprimantes.
)
echo.
echo Appuyez sur une touche pour demarrer Bar POS...
pause >nul
goto :demarrer_app

REM ----------------------------------------------------------------------------
REM ACTION : REINITIALISER L'IP
REM ----------------------------------------------------------------------------
:action_reset_ip
if exist "%IP_FILE%" del /f /q "%IP_FILE%" >nul 2>&1
set "LOCAL_SERVER_FOUND="
echo.
echo Configuration IP reinitialisee.
echo.
goto :saisie_ip

REM ----------------------------------------------------------------------------
REM DEMARRAGE DE L'APPLICATION
REM ----------------------------------------------------------------------------
:demarrer_app
set "SERVER_HOST="

REM 1. Si nous sommes sur le serveur local, utiliser directement localhost
if defined LOCAL_SERVER_FOUND (
    set "SERVER_HOST=localhost"
    >"%IP_FILE%" echo localhost
    goto :lancer
)

REM 2. Sinon, verifier la derniere IP memorisee si elle fonctionne
if exist "%IP_FILE%" (
    set /p MEM_IP=<"%IP_FILE%"
    if defined MEM_IP (
        set "SERVER_HOST=!MEM_IP!"
        goto :lancer
    )
)

REM 3. Recherche reseau via PowerShell
echo [1/3] Recherche du serveur WAMP sur le reseau...
set "DETECTED_IP="
set "OUT_FILE=%TEMP%\barpos_detected_ip_%RANDOM%.txt"
if exist "%OUT_FILE%" del /f /q "%OUT_FILE%" >nul 2>&1

if defined PS_EXE (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" "%IP_FILE%" > "%OUT_FILE%" 2>nul
    if exist "%OUT_FILE%" (
        set /p DETECTED_IP=<"%OUT_FILE%"
        del /f /q "%OUT_FILE%" >nul 2>&1
    )
)

if defined TMP_PS if exist "%PS_SCRIPT%" del /f /q "%PS_SCRIPT%" >nul 2>&1

if defined DETECTED_IP (
    set "DETECTED_IP=!DETECTED_IP: =!"
    if defined DETECTED_IP (
        set "SERVER_HOST=!DETECTED_IP!"
        echo        OK : serveur detecte a l'adresse !SERVER_HOST!
        >"%IP_FILE%" echo !SERVER_HOST!
        goto :lancer
    )
)

REM ----------------------------------------------------------------------------
REM SAISIE MANUELLE SI NON DETECTE
REM ----------------------------------------------------------------------------
:saisie_ip
echo.
echo ============================================================================
echo   Configuration de l'adresse du serveur WAMP
echo ============================================================================
echo.
echo Entrez l'adresse IP du serveur WAMP (ou 'localhost' si vous etes sur le serveur).
echo Exemples :
echo   - Si vous etes sur le PC serveur : localhost
echo   - Si vous etes sur une tablette ou un autre PC : 192.168.1.50
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
REM LANCEMENT DU NAVIGATEUR EN MODE KIOSQUE
REM ----------------------------------------------------------------------------
:lancer
set "APP_URL=http://!SERVER_HOST!/logbara/"
echo.
echo [2/3] Connexion a : !APP_URL!

set "BROWSER_EXE="

REM Google Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

REM Microsoft Edge
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if not defined BROWSER_EXE (
    where chrome.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "BROWSER_EXE=chrome.exe"
)
if not defined BROWSER_EXE (
    where msedge.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "BROWSER_EXE=msedge.exe"
)

echo [3/3] Lancement de Bar POS en mode Kiosque 80mm...
if defined BROWSER_EXE (
    if defined PRINT_DIALOG (
        start "Bar POS" "!BROWSER_EXE!" --user-data-dir="%KIOSK_PROFILE%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --new-window --start-fullscreen --app="!APP_URL!"
    ) else (
        start "Bar POS" "!BROWSER_EXE!" --user-data-dir="%KIOSK_PROFILE%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --kiosk-printing --new-window --start-fullscreen --app="!APP_URL!"
    )
) else (
    start "" "!APP_URL!"
)

echo.
echo ============================================================================
echo   Bar POS est pret !
echo   - Pour changer l'imprimante a tout moment : lancer clientwamp.bat puis tapez P
echo   - Pour changer l'adresse IP              : lancer clientwamp.bat puis tapez S
echo ============================================================================
timeout /t 2 >nul 2>&1
exit /b 0

REM ============================================================================
REM SCRIPT POWERSHELL EMBARQUE (fallback si detect_server.ps1 est absent)
REM ============================================================================
#BARPOS_PS_BEGIN
param(
    [string]$savedIpFile = "",
    [switch]$selectPrinter = $false,
    [switch]$showPrinter = $false,
    [switch]$getPrinter = $false
)

$configDir = "$env:LOCALAPPDATA\LogBara"
$printerFile = "$configDir\printer_name.txt"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force -ErrorAction SilentlyContinue | Out-Null
}

function Get-SystemPrinters {
    $list = @()
    try {
        $list = @(Get-CimInstance Win32_Printer -ErrorAction Stop | Sort-Object Name)
    } catch {
        try {
            $list = @(Get-WmiObject Win32_Printer -ErrorAction Stop | Sort-Object Name)
        } catch {}
    }
    return $list
}

function Get-CurrentDefaultPrinter {
    if (Test-Path $printerFile) {
        try {
            $saved = (Get-Content $printerFile -Raw -ErrorAction SilentlyContinue).Trim()
            if ($saved) { return $saved }
        } catch {}
    }
    try {
        $printers = Get-SystemPrinters
        $def = $printers | Where-Object { $_.Default } | Select-Object -First 1
        if ($def) { return $def.Name }
        if ($printers.Count -gt 0) { return $printers[0].Name }
    } catch {}
    return "Aucune"
}

if ($getPrinter) {
    Write-Output (Get-CurrentDefaultPrinter)
    exit 0
}

if ($showPrinter) {
    $current = Get-CurrentDefaultPrinter
    Write-Host "  Imprimante ticket 80mm : $current" -ForegroundColor Cyan
    exit 0
}

if ($selectPrinter) {
    try {
        $printers = Get-SystemPrinters
        if ($printers.Count -eq 0) {
            Write-Host "Aucune imprimante detectee sous Windows." -ForegroundColor Red
            exit 0
        }

        $currentDef = Get-CurrentDefaultPrinter

        Write-Host ""
        Write-Host "============================================================================" -ForegroundColor Yellow
        Write-Host "  CHOIX DE L'IMPRIMANTE TICKET PAR DEFAUT POUR BAR POS (MODE KIOSQUE 80MM)" -ForegroundColor Yellow
        Write-Host "============================================================================" -ForegroundColor Yellow
        Write-Host "Choisissez l'imprimante thermique 80mm pour l'impression directe des tickets :"
        Write-Host ""
        for ($i = 0; $i -lt $printers.Count; $i++) {
            $p = $printers[$i]
            $tag = ""
            if ($p.Name -eq $currentDef) {
                $tag = " [ACTUELLE / DEFAUT]"
            } elseif ($p.Default) {
                $tag = " [DEFAUT WINDOWS]"
            }
            Write-Host "  [$($i+1)] $($p.Name)$tag"
        }
        Write-Host ""
        $choice = Read-Host "Entrez le numero de l'imprimante a utiliser dans Bar POS"
        if ($choice -match '^\d+$' -and [int]$choice -ge 1 -and [int]$choice -le $printers.Count) {
            $selected = $printers[[int]$choice - 1]
            $printerName = $selected.Name

            try {
                taskkill /f /im chrome.exe /fi "WINDOWTITLE eq Bar POS*" 2>$null | Out-Null
                taskkill /f /im msedge.exe /fi "WINDOWTITLE eq Bar POS*" 2>$null | Out-Null
            } catch {}

            try {
                Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows" -Name "LegacyDefaultPrinterMode" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
            } catch {}

            try {
                Start-Process -FilePath "rundll32.exe" -ArgumentList "printui.dll,PrintUIEntry /y /n `"$printerName`"" -NoNewWindow -Wait -ErrorAction SilentlyContinue
            } catch {}

            try {
                (New-Object -ComObject WScript.Network).SetDefaultPrinter($printerName)
            } catch {}
            try {
                $escaped = $printerName.Replace("'", "''")
                $cimP = Get-CimInstance Win32_Printer -Filter "Name='$escaped'" -ErrorAction SilentlyContinue
                if ($cimP) { Invoke-CimMethod -InputObject $cimP -MethodName SetDefaultPrinter -ErrorAction SilentlyContinue | Out-Null }
            } catch {}

            try {
                Set-Content -Path $printerFile -Value $printerName -Encoding UTF8 -Force
            } catch {}

            try {
                $prefDir = "$configDir\KioskProfile\Default"
                if (-not (Test-Path $prefDir)) {
                    New-Item -ItemType Directory -Path $prefDir -Force -ErrorAction SilentlyContinue | Out-Null
                }
                $prefFile = Join-Path $prefDir "Preferences"

                $appStateObj = @{
                    version = 2
                    recentDestinations = @(
                        @{
                            id = $printerName
                            origin = "local"
                            account = ""
                            capabilities = @{}
                            displayName = $printerName
                            extensionId = ""
                            extensionName = ""
                        }
                    )
                    isHeaderFooterEnabled = $false
                    isCssBackgroundEnabled = $true
                    marginsType = 2
                    mediaSize = @{
                        name = "CUSTOM"
                        width_microns = 80000
                        height_microns = 297000
                    }
                }
                $appStateJson = ConvertTo-Json -Compress $appStateObj

                $prefsObj = @{
                    printing = @{
                        print_preview_sticky_settings = @{
                            appState = $appStateJson
                        }
                    }
                }

                if (Test-Path $prefFile) {
                    try {
                        $raw = Get-Content $prefFile -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json
                        if (-not $raw.printing) { $raw | Add-Member -MemberType NoteProperty -Name "printing" -Value @{} }
                        $raw.printing.print_preview_sticky_settings = @{ appState = $appStateJson }
                        $raw | ConvertTo-Json -Depth 15 | Set-Content $prefFile -Encoding UTF8 -Force
                    } catch {
                        $prefsObj | ConvertTo-Json -Depth 10 | Set-Content $prefFile -Encoding UTF8 -Force
                    }
                } else {
                    $prefsObj | ConvertTo-Json -Depth 10 | Set-Content $prefFile -Encoding UTF8 -Force
                }
            } catch {}

            Write-Host ""
            Write-Host "✓ Imprimante ticket enregistree : '$printerName'" -ForegroundColor Green
            Write-Host "✓ Format regle sur 80mm sans marge pour le Mode Kiosque direct." -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host "Aucun changement d'imprimante effectue." -ForegroundColor Gray
        }
    } catch {
        Write-Host "Erreur lors de la configuration de l'imprimante : $_" -ForegroundColor Red
    }
    exit 0
}

[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

function Test-TcpPort([string]$hostOrIp, [int]$port, [int]$timeoutMs = 600) {
    if ([string]::IsNullOrWhiteSpace($hostOrIp)) { return $false }
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect($hostOrIp, $port, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne($timeoutMs, $false)) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
    } catch {}
    return $false
}

function Test-BarPosUrl([string]$url, [int]$timeoutMs = 1200) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Timeout = $timeoutMs
        $req.Proxy = $null
        $req.ServicePoint.Expect100Continue = $false
        $req.Method = "GET"
        $req.Headers.Add("X-BarPOS-Request", "1")
        $req.AllowAutoRedirect = $true
        $res = $req.GetResponse()
        $stream = $res.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        $reader.Close()
        $res.Close()

        if ($content -match "Starlink" -or $content -match "starlink") { return $false }
        if ($content -match "<response" -or $content -match "barpos" -or $content -match "Bar POS" -or $content -match "LogBara" -or $content -match "logbara" -or $content -match "Point de Vente") {
            return $true
        }
    } catch {
        if ($_.Exception.Response) {
            try {
                $errStream = $_.Exception.Response.GetResponseStream()
                if ($errStream) {
                    $reader = New-Object System.IO.StreamReader($errStream)
                    $errContent = $reader.ReadToEnd()
                    $reader.Close()
                    if ($errContent -match "<response" -or $errContent -match "barpos" -or $errContent -match "LogBara") {
                        return $true
                    }
                }
            } catch {}
        }
    }
    return $false
}

function Test-BarPos([string]$hostOrIp, [int]$port = 80) {
    if ([string]::IsNullOrWhiteSpace($hostOrIp)) { return $false }
    $h = $hostOrIp.Trim()
    if ($h -match '^([^:]+):(\d+)$') {
        $h = $matches[1]
        $port = [int]$matches[2]
    }
    if (-not (Test-TcpPort $h $port 400)) { return $false }
    $hostWithPort = if ($port -eq 80) { $h } else { "$h`:$port" }
    $paths = @("logbara", "barpos", "", "wamp_deploy")
    foreach ($p in $paths) {
        $prefix = if ($p) { "/$p" } else { "" }
        if (Test-BarPosUrl "http://$hostWithPort$prefix/api/index.php" 1000) { return $true }
        if (Test-BarPosUrl "http://$hostWithPort$prefix/" 1000) { return $true }
    }
    return $false
}

$isLocalServer = $false
try {
    $procCount = @(Get-Process httpd, wampmanager, mysqld, mariadbd -ErrorAction SilentlyContinue).Count
    if ($procCount -gt 0) { $isLocalServer = $true }
    foreach ($d in @("C:", "D:", "E:")) {
        if ((Test-Path "$d\wamp64") -or (Test-Path "$d\wamp")) { $isLocalServer = $true; break }
    }
    if ((Test-Path "$PSScriptRoot\api\config.php") -or (Test-Path "$PSScriptRoot\index.html")) {
        $isLocalServer = $true
    }
} catch {}

if ($isLocalServer) {
    if (Test-TcpPort "127.0.0.1" 80 400) {
        Write-Output "localhost"
        exit 0
    }
    if (Test-TcpPort "127.0.0.1" 8080 400) {
        Write-Output "localhost:8080"
        exit 0
    }
    if (@(Get-Process httpd -ErrorAction SilentlyContinue).Count -gt 0) {
        Write-Output "localhost"
        exit 0
    }
}

foreach ($localHost in @("127.0.0.1", "localhost")) {
    foreach ($localPort in @(80, 8080, 8000)) {
        if (Test-BarPos $localHost $localPort) {
            $result = if ($localPort -eq 80) { $localHost } else { "$localHost`:$localPort" }
            Write-Output $result
            exit 0
        }
    }
}

if ($savedIpFile -and (Test-Path $savedIpFile)) {
    try {
        $saved = (Get-Content $savedIpFile -Raw -ErrorAction SilentlyContinue)
        if ($saved) {
            $saved = $saved.Trim()
            if ($saved -and (Test-BarPos $saved)) {
                Write-Output $saved
                exit 0
            }
        }
    } catch {}
}

$candidates = [System.Collections.Generic.List[string]]::new()
try {
    $routes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue
    foreach ($r in $routes) {
        if ($r.NextHop -and $r.NextHop -ne '0.0.0.0') {
            if (-not $candidates.Contains($r.NextHop)) { $candidates.Add($r.NextHop) }
        }
    }
} catch {}

try {
    $arp = (arp -a) -join "`n"
    $found = [regex]::Matches($arp, '\b(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b')
    foreach ($m in $found) {
        $ip = $m.Value
        if (-not $ip.EndsWith('.255') -and -not $ip.EndsWith('.0') -and -not $ip.StartsWith('127.')) {
            if (-not $candidates.Contains($ip)) { $candidates.Add($ip) }
        }
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
    if (Test-BarPos $ip) {
        Write-Output $ip
        exit 0
    }
}

exit 1
