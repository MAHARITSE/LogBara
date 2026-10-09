@echo off
REM ============================================================================
REM Bar POS (LogBara) - Lanceur universel unique (clientwamp.bat)
REM - Detecte automatiquement si le serveur WAMP tourne en local (localhost)
REM   ou sur le reseau (Wi-Fi, Ethernet, Hotspot)
REM - Gere la memorisation de l'IP du serveur et le lancement de
REM   Chrome/Edge avec --kiosk-printing (impression directe)
REM - Option --imprimante (alias -i) : affiche la liste des imprimantes Windows
REM   et permet de choisir l'imprimante a utiliser pour les tickets
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

REM Localisation de PowerShell (necessaire pour la detection IP et la gestion de l'imprimante)
set "PS_EXE="
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not defined PS_EXE (
    where powershell.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "PS_EXE=powershell.exe"
)

REM Preparation du script PowerShell
set "PS_SCRIPT=%~dp0detect_server.ps1"
if not exist "%PS_SCRIPT%" (
    set "BARPOS_SELF=%~f0"
    set "PS_SCRIPT=%TEMP%\barpos_detect_%RANDOM%.ps1"
    set "TMP_PS=1"
    if defined PS_EXE (
        "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:BARPOS_SELF); $m='#BARPOS'+'_PS_BEGIN'; $i=$t.IndexOf($m); if ($i -lt 0) { exit 1 }; [IO.File]::WriteAllText($env:PS_SCRIPT, $t.Substring($i+$m.Length))" >nul 2>&1
    )
)

REM Choix interactif de l'imprimante via parametre en ligne de commande
if /i "%~1"=="--imprimante" goto :action_select_printer
if /i "%~1"=="--printer" goto :action_select_printer
if /i "%~1"=="--choix-imprimante" goto :action_select_printer
if /i "%~1"=="-i" goto :action_select_printer

REM Reinitialisation manuelle de l'IP si demande via --reset ou -c
if /i "%~1"=="--reset" goto :action_reset_ip
if /i "%~1"=="-c" goto :action_reset_ip

REM Mode "choix de l'imprimante" : --dialogue (alias -d ou --choix)
set "PRINT_DIALOG="
if /i "%~1"=="--dialogue" set "PRINT_DIALOG=1"
if /i "%~1"=="--choix" set "PRINT_DIALOG=1"
if /i "%~1"=="-d" set "PRINT_DIALOG=1"

REM Si aucun argument, afficher le menu d'accueil rapide (auto-demarrage apres 3 secondes)
if "%~1"=="" (
    echo ============================================================================
    echo   Bar POS - Point de Vente (LogBara)
    echo ============================================================================
    if defined PS_EXE (
        "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -showPrinter 2>nul
    )
    echo.
    echo   Options :
    echo     [1] Lancer Bar POS (Mode Kiosque - Impression directe)
    echo     [2] Choisir l'imprimante ticket par defaut pour le mode kiosque
    echo     [3] Reinitialiser l'adresse IP du serveur
    echo.
    echo   Demarrage de Bar POS dans 3 secondes (ou tapez 2 pour l'imprimante)...
    choice /c 123 /t 3 /d 1 /n >nul 2>&1
    if errorlevel 3 goto :action_reset_ip
    if errorlevel 2 goto :action_select_printer
)

goto :demarrer_app

:action_select_printer
echo.
echo ============================================================================
echo   Configuration de l'imprimante ticket pour le Mode Kiosque
echo ============================================================================
if defined PS_EXE (
    taskkill /f /im chrome.exe /fi "WINDOWTITLE eq Bar POS*" >nul 2>&1
    taskkill /f /im msedge.exe /fi "WINDOWTITLE eq Bar POS*" >nul 2>&1
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -selectPrinter
    if exist "%KIOSK_PROFILE%" rd /s /q "%KIOSK_PROFILE%" >nul 2>&1
) else (
    echo PowerShell non disponible pour lister les imprimantes.
)
echo.
echo Appuyez sur une touche pour lancer Bar POS...
pause >nul
goto :demarrer_app

:action_reset_ip
if exist "%IP_FILE%" del /f /q "%IP_FILE%" >nul 2>&1
if exist "%KIOSK_PROFILE%" rd /s /q "%KIOSK_PROFILE%" >nul 2>&1
echo Configuration IP et profil reinitialises.
echo.
goto :demarrer_app

:demarrer_app
echo ============================================================================
echo   Bar POS - Connexion au serveur WAMP
echo ============================================================================
if defined PS_EXE (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -showPrinter 2>nul
)
echo.

set "SERVER_HOST="
set "DETECTED_IP="
set "OUT_FILE=%TEMP%\barpos_detected_ip_%RANDOM%.txt"
if exist "%OUT_FILE%" del /f /q "%OUT_FILE%" >nul 2>&1

REM ----------------------------------------------------------------------------
REM 1. RECHERCHE ET EXECUTION DU SCRIPT DE DETECTION POWERSHELL
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
echo   Pour choisir l'imprimante a utiliser dans Bar POS :
echo   clientwamp.bat --imprimante
echo   Pour reinitialiser l'imprimante par defaut apres un changement Windows :
echo   clientwamp.bat --reset-printer
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
param(
    [string]$savedIpFile = "",
    [switch]$selectPrinter = $false,
    [switch]$showPrinter = $false
)

if ($selectPrinter) {
    try {
        $printers = @(Get-CimInstance Win32_Printer | Sort-Object Name)
        if ($printers.Count -eq 0) {
            Write-Host "Aucune imprimante detectee sous Windows." -ForegroundColor Red
            exit 0
        }
        Write-Host "============================================================================" -ForegroundColor Yellow
        Write-Host "  CHOIX DE L'IMPRIMANTE TICKET PAR DEFAUT POUR BAR POS (MODE KIOSQUE)" -ForegroundColor Yellow
        Write-Host "============================================================================" -ForegroundColor Yellow
        for ($i = 0; $i -lt $printers.Count; $i++) {
            $p = $printers[$i]
            $def = if ($p.Default) { " [DEFAUT ACTUEL]" } else { "" }
            Write-Host "  [$($i+1)] $($p.Name)$def"
        }
        Write-Host ""
        $choice = Read-Host "Entrez le numero de l'imprimante a utiliser dans Bar POS"
        if ($choice -match '^\d+$' -and [int]$choice -ge 1 -and [int]$choice -le $printers.Count) {
            $selected = $printers[[int]$choice - 1]
            $printerName = $selected.Name

            # 1. Desactiver l'option Windows 10/11 'Laisser Windows gerer mon imprimante par defaut'
            try {
                Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows" -Name "LegacyDefaultPrinterMode" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
            } catch {}

            # 2. Definir l'imprimante par defaut au niveau du systeme Windows
            try {
                (New-Object -ComObject WScript.Network).SetDefaultPrinter($printerName)
            } catch {}
            try {
                Invoke-CimMethod -InputObject $selected -MethodName SetDefaultPrinter -ErrorAction SilentlyContinue | Out-Null
            } catch {}
            try {
                (Get-WmiObject -Query "Select * From Win32_Printer Where Name = '$printerName'").SetDefaultPrinter() | Out-Null
            } catch {}

            # 3. Injecter l'imprimante choisie directement dans le profil Chrome/Edge Kiosque
            try {
                $prefDir = "$env:LOCALAPPDATA\LogBara\KioskProfile\Default"
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
            Write-Host "✓ Imprimante ticket enregistree avec succes : '$printerName'" -ForegroundColor Green
            Write-Host "✓ Le mode kiosque enverra les tickets directement a cette imprimante." -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host "Aucun changement d'imprimante effectue." -ForegroundColor Gray
        }
    } catch {
        Write-Host "Erreur lors de la configuration de l'imprimante : $_" -ForegroundColor Red
    }
    exit 0
}

if ($showPrinter) {
    try {
        $p = Get-CimInstance Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1
        if ($p) {
            Write-Host "   Imprimante par defaut Windows actuelle : $($p.Name)" -ForegroundColor Cyan
        }
    } catch {}
    exit 0
}

[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

function Test-BarPosUrl([string]$url) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Timeout = 1500
        $req.Method = "GET"
        $req.Headers.Add("X-BarPOS-Request", "1")
        $req.AllowAutoRedirect = $true
        $res = $req.GetResponse()
        $stream = $res.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        $reader.Close()
        $res.Close()

        if ($content -match "Starlink" -or $content -match "starlink") {
            return $false
        }

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
    $hostWithPort = if ($port -eq 80) { $h } else { "$h`:$port" }

    $paths = @("logbara", "barpos", "", "wamp_deploy")
    foreach ($p in $paths) {
        $pathPrefix = if ($p) { "/$p" } else { "" }
        if (Test-BarPosUrl "http://$hostWithPort$pathPrefix/api/index.php") {
            return $true
        }
        if (Test-BarPosUrl "http://$hostWithPort$pathPrefix/") {
            return $true
        }
    }
    return $false
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

try {
    $httpdRunning = (Get-Process httpd -ErrorAction SilentlyContinue)
    if ($httpdRunning) {
        $wampDirs = @("C:\wamp64\www\logbara", "C:\wamp\www\logbara", "C:\wamp64\www", "C:\wamp\www")
        foreach ($wd in $wampDirs) {
            if (Test-Path $wd) {
                Write-Output "localhost"
                exit 0
            }
        }
    }
} catch {}

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
        if (-not $ip.EndsWith('.255') -and -not $ip.EndsWith('.0') -and -not $ip.StartsWith('127.') -and -not $candidates.Contains($ip)) { $candidates.Add($ip) }
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
