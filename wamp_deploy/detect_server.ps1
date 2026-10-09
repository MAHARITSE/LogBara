# ==============================================================================
# Bar POS (LogBara) - Detection automatique de l'adresse du serveur WAMP
# Lanceur universel unique (clientwamp.bat) :
# - Detecte automatiquement si le serveur WAMP tourne en local (localhost)
#   ou sur le reseau (Wi-Fi, Ethernet, Hotspot)
# - Gere la memorisation de l'IP du serveur et le lancement de
#   Chrome/Edge avec --kiosk-printing (impression directe)
# - Gere le choix de l'imprimante ticket par defaut pour le mode kiosque
# ==============================================================================
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
            #    pour forcer --kiosk-printing a imprimer sur cette imprimante sans dialogue
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

# Fonction robuste pour tester si une URL repond et contient Bar POS
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
        # Si le serveur HTTP repond mais avec un code d'erreur (ex: 500 ou 400), examiner la reponse
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

# Teste un hote (IP ou localhost) sur plusieurs chemins possibles
function Test-BarPos([string]$hostOrIp, [int]$port = 80) {
    if ([string]::IsNullOrWhiteSpace($hostOrIp)) { return $false }
    $h = $hostOrIp.Trim()
    if ($h -match '^([^:]+):(\d+)$') {
        $h = $matches[1]
        $port = [int]$matches[2]
    }
    $hostWithPort = if ($port -eq 80) { $h } else { "$h`:$port" }

    # Chemins a tester par ordre de probabilite
    $paths = @("logbara", "barpos", "", "wamp_deploy")
    foreach ($p in $paths) {
        $pathPrefix = if ($p) { "/$p" } else { "" }

        # 1. Test API
        if (Test-BarPosUrl "http://$hostWithPort$pathPrefix/api/index.php") {
            return $true
        }
        # 2. Test page HTML
        if (Test-BarPosUrl "http://$hostWithPort$pathPrefix/") {
            return $true
        }
    }
    return $false
}

# ------------------------------------------------------------------------------
# 1. TEST SERVEUR LOCAL (localhost / 127.0.0.1)
# ------------------------------------------------------------------------------
foreach ($localHost in @("127.0.0.1", "localhost")) {
    foreach ($localPort in @(80, 8080, 8000)) {
        if (Test-BarPos $localHost $localPort) {
            $result = if ($localPort -eq 80) { $localHost } else { "$localHost`:$localPort" }
            Write-Output $result
            exit 0
        }
    }
}

# Heuristique serveur local : si Apache (httpd) tourne localement et que WAMP existe sur le disque
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

# ------------------------------------------------------------------------------
# 2. TEST DERNIERE IP MEMORISEE
# ------------------------------------------------------------------------------
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

# ------------------------------------------------------------------------------
# 3. TEST ADRESSES CANDIDATES SUR LE RESEAU LOCAL
# ------------------------------------------------------------------------------
$candidates = [System.Collections.Generic.List[string]]::new()

# Passerelles reseau
try {
    $routes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue
    foreach ($r in $routes) {
        if ($r.NextHop -and $r.NextHop -ne '0.0.0.0') {
            if (-not $candidates.Contains($r.NextHop)) { $candidates.Add($r.NextHop) }
        }
    }
} catch {}

# Cache ARP (appareils actifs visibles)
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

# Sous-reseaux locaux
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

# Serveur non detecte automatiquement
exit 1
