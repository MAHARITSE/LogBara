# ==============================================================================
# Bar POS (LogBara) - Detection serveur WAMP & Gestion Imprimante 80mm Kiosque
# ==============================================================================
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

# ------------------------------------------------------------------------------
# A. RECUPERATION DE LA LISTE DES IMPRIMANTES
# ------------------------------------------------------------------------------
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
    # 1. Verifier si une imprimante a ete explicitement memorisee pour Bar POS
    if (Test-Path $printerFile) {
        try {
            $saved = (Get-Content $printerFile -Raw -ErrorAction SilentlyContinue).Trim()
            if ($saved) { return $saved }
        } catch {}
    }
    # 2. Imprimante par defaut Windows actuelle
    try {
        $printers = Get-SystemPrinters
        $def = $printers | Where-Object { $_.Default } | Select-Object -First 1
        if ($def) { return $def.Name }
        if ($printers.Count -gt 0) { return $printers[0].Name }
    } catch {}
    return "Aucune"
}

# ------------------------------------------------------------------------------
# B. RENVOYER UNIQUEMENT LE NOM DE L'IMPRIMANTE ACTUELLE (-getPrinter)
# ------------------------------------------------------------------------------
if ($getPrinter) {
    Write-Output (Get-CurrentDefaultPrinter)
    exit 0
}

# ------------------------------------------------------------------------------
# C. AFFICHER L'IMPRIMANTE ACTUELLE (-showPrinter)
# ------------------------------------------------------------------------------
if ($showPrinter) {
    $current = Get-CurrentDefaultPrinter
    Write-Host "  Imprimante ticket 80mm : $current" -ForegroundColor Cyan
    exit 0
}

# ------------------------------------------------------------------------------
# D. SELECTION INTERACTIVE DE L'IMPRIMANTE TICKET (-selectPrinter)
# ------------------------------------------------------------------------------
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

            # Fermer les instances Kiosque en cours pour debloquer le fichier Preferences
            try {
                taskkill /f /im chrome.exe /fi "WINDOWTITLE eq Bar POS*" 2>$null | Out-Null
                taskkill /f /im msedge.exe /fi "WINDOWTITLE eq Bar POS*" 2>$null | Out-Null
            } catch {}

            # 1. Desactiver la gestion automatique Windows 10/11 qui modifie l'imprimante
            try {
                Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows" -Name "LegacyDefaultPrinterMode" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
            } catch {}

            # 2. Definir l'imprimante par defaut au niveau Windows (commande Win32 native printui)
            try {
                Start-Process -FilePath "rundll32.exe" -ArgumentList "printui.dll,PrintUIEntry /y /n `"$printerName`"" -NoNewWindow -Wait -ErrorAction SilentlyContinue
            } catch {}

            # Fallbacks WScript & WMI
            try {
                (New-Object -ComObject WScript.Network).SetDefaultPrinter($printerName)
            } catch {}
            try {
                $escaped = $printerName.Replace("'", "''")
                $cimP = Get-CimInstance Win32_Printer -Filter "Name='$escaped'" -ErrorAction SilentlyContinue
                if ($cimP) { Invoke-CimMethod -InputObject $cimP -MethodName SetDefaultPrinter -ErrorAction SilentlyContinue | Out-Null }
            } catch {}

            # 3. Memoriser le nom dans le fichier de config
            try {
                Set-Content -Path $printerFile -Value $printerName -Encoding UTF8 -Force
            } catch {}

            # 4. Injecter directement dans le profil Kiosque Chrome/Edge (80mm sans marge)
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

# ------------------------------------------------------------------------------
# E. DETECTION AUTOMATIQUE DE L'ADRESSE DU SERVEUR WAMP
# ------------------------------------------------------------------------------
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

# Test rapide de connectivite TCP (evite les timeouts et les proxys)
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

# Test HTTP cible
function Test-BarPosUrl([string]$url, [int]$timeoutMs = 1200) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Timeout = $timeoutMs
        $req.Proxy = $null # CRITIQUE : desactive la recherche de proxy Windows (empeche les blocages sur localhost)
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
    if (-not (Test-TcpPort $h $port 400)) {
        return $false
    }
    $hostWithPort = if ($port -eq 80) { $h } else { "$h`:$port" }
    $paths = @("logbara", "barpos", "", "wamp_deploy")
    foreach ($p in $paths) {
        $prefix = if ($p) { "/$p" } else { "" }
        if (Test-BarPosUrl "http://$hostWithPort$prefix/api/index.php" 1000) { return $true }
        if (Test-BarPosUrl "http://$hostWithPort$prefix/" 1000) { return $true }
    }
    return $false
}

# 1. VERIFICATION SI NOUS SOMMES SUR LE SERVEUR LOCAL (localhost / 127.0.0.1)
$isLocalServer = $false
try {
    # Apache ou WAMP est-il en cours d'execution sur ce PC ?
    $procCount = @(Get-Process httpd, wampmanager, mysqld, mariadbd -ErrorAction SilentlyContinue).Count
    if ($procCount -gt 0) { $isLocalServer = $true }

    # Repertoires WAMP presents sur les disques ?
    foreach ($d in @("C:", "D:", "E:")) {
        if ((Test-Path "$d\wamp64") -or (Test-Path "$d\wamp")) { $isLocalServer = $true; break }
    }

    # Le script s'execute-t-il dans le dossier www de WAMP ou contient-il l'API ?
    if ((Test-Path "$PSScriptRoot\api\config.php") -or (Test-Path "$PSScriptRoot\index.html")) {
        $isLocalServer = $true
    }
} catch {}

if ($isLocalServer) {
    # Si port 80 ou 8080 est ouvert en local, localhost est garanti !
    if (Test-TcpPort "127.0.0.1" 80 400) {
        Write-Output "localhost"
        exit 0
    }
    if (Test-TcpPort "127.0.0.1" 8080 400) {
        Write-Output "localhost:8080"
        exit 0
    }
    # Si le processus httpd tourne, renvoyer localhost
    if (@(Get-Process httpd -ErrorAction SilentlyContinue).Count -gt 0) {
        Write-Output "localhost"
        exit 0
    }
}

# Test exhaustif localhost / 127.0.0.1
foreach ($localHost in @("127.0.0.1", "localhost")) {
    foreach ($localPort in @(80, 8080, 8000)) {
        if (Test-BarPos $localHost $localPort) {
            $result = if ($localPort -eq 80) { $localHost } else { "$localHost`:$localPort" }
            Write-Output $result
            exit 0
        }
    }
}

# 2. TEST DE LA DERNIERE IP MEMORISEE
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

# 3. TEST SUR LE RESEAU LOCAL (Passerelle, ARP, sous-reseaux)
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
