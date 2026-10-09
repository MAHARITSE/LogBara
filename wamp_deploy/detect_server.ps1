# ==============================================================================
# Bar POS (LogBara) - Detection automatique de l'adresse du serveur WAMP
# Lanceur universel unique (clientwamp.bat) :
# - Détecte automatiquement si le serveur WAMP tourne en local (localhost)
#   ou sur le réseau (Wi-Fi, Ethernet, Hotspot)
# - Gère la mémorisation de l'IP du serveur et le lancement de
#   Chrome/Edge avec --kiosk-printing (impression directe)
# - Supprime le lancer-impression-directe.bat au profit de ce lanceur universel
# Compatible avec : Localhost, Wi-Fi, Ethernet, Hotspot, 4G, sous-réseaux LAN
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
        Write-Host "  CHOIX DE L'IMPRIMANTE PAR DEFAUT POUR BAR POS" -ForegroundColor Yellow
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
            (New-Object -ComObject WScript.Network).SetDefaultPrinter($selected.Name)
            Write-Host "✓ Imprimante par defaut Windows definie sur : '$($selected.Name)'" -ForegroundColor Green
        } else {
            Write-Host "Aucun changement d'imprimante effectue." -ForegroundColor Gray
        }
    } catch {
        Write-Host "Erreur lors de la liste des imprimantes : $_" -ForegroundColor Red
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

# Detecte le dossier courant pour tester aussi son nom dans les chemins d'URL
$currentFolderName = ""
try {
    if ($PSScriptRoot) {
        $currentFolderName = Split-Path -Leaf $PSScriptRoot
    }
} catch {}

function Test-BarPos([string]$hostOrIp, [int]$port = 80) {
    if ([string]::IsNullOrWhiteSpace($hostOrIp)) { return $false }
    $h = $hostOrIp.Trim()
    
    # Si l'hote contient deja un port (ex: localhost:8080)
    if ($h -match '^([^:]+):(\d+)$') {
        $h = $matches[1]
        $port = [int]$matches[2]
    }
    
    # Test de connectivite TCP (timeout 1000ms au lieu de 250ms pour eviter les faux negatifs Windows)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect($h, $port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(1000, $false) -or -not $tcp.Connected) {
            $tcp.Close()
            return $false
        }
        $tcp.EndConnect($iar)
        $tcp.Close()
    } catch {
        return $false
    }

    $hostWithPort = if ($port -eq 80) { $h } else { "$h`:$port" }

    # Chemins d'application a tester (logbara, barpos, nom du dossier courant, et racine)
    $appPaths = @("logbara", "barpos")
    if ($currentFolderName -and -not $appPaths.Contains($currentFolderName.ToLower())) {
        $appPaths += $currentFolderName
    }

    foreach ($appPath in $appPaths) {
        # 1. Test specifique de l'API Bar POS
        try {
            $apiUrl = "http://$hostWithPort/$appPath/api/index.php"
            $reqApi = [System.Net.HttpWebRequest]::Create($apiUrl)
            $reqApi.Timeout = 2000
            $reqApi.Method = "GET"
            $reqApi.Headers.Add("X-BarPOS-Request", "1")
            $resApi = $reqApi.GetResponse()
            $stream = $resApi.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            $reader.Close()
            $resApi.Close()

            if ($content -match "Starlink" -or $content -match "starlink") {
                return $false
            }

            if ($content -match "<response" -or $content -match "barpos" -or $content -match "Bar POS" -or $content -match "LogBara" -or $content -match "logbara") {
                return $true
            }
        } catch {}

        # 2. Test secondaire sur l'interface HTML
        try {
            $url = "http://$hostWithPort/$appPath/"
            $req = [System.Net.HttpWebRequest]::Create($url)
            $req.Timeout = 2000
            $req.Method = "GET"
            $req.AllowAutoRedirect = $true
            $res = $req.GetResponse()
            $stream = $res.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $html = $reader.ReadToEnd()
            $reader.Close()
            $res.Close()

            if ($html -match "Starlink" -or $html -match "starlink") {
                return $false
            }

            if ($html -match "Bar POS" -or $html -match "barpos" -or $html -match "Point de Vente" -or $html -match "LogBara" -or $html -match "logbara") {
                return $true
            }
        } catch {}
    }

    return $false
}

# 1. Test 127.0.0.1 et localhost (Machine serveur elle-meme)
# Priorite a 127.0.0.1 pour eviter les delais et echecs de resolution IPv6 ::1 sous Windows
foreach ($localHost in @("127.0.0.1", "localhost")) {
    foreach ($localPort in @(80, 8080, 8000)) {
        if (Test-BarPos $localHost $localPort) {
            $result = if ($localPort -eq 80) { $localHost } else { "$localHost`:$localPort" }
            Write-Output $result
            exit 0
        }
    }
}

# 2. Test derniere IP memorisee
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

# 3. Construction des adresses IP candidates sur le reseau local
$candidates = [System.Collections.Generic.List[string]]::new()

# Passerelles reseau (box, routeur, point d'acces mobile)
try {
    $routes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue
    foreach ($r in $routes) {
        if ($r.NextHop -and $r.NextHop -ne '0.0.0.0') {
            if (-not $candidates.Contains($r.NextHop)) { $candidates.Add($r.NextHop) }
        }
    }
} catch {}

# Cache ARP (appareils actifs visibles sur le reseau local)
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

# Sous-reseaux des cartes reseau locales (Ethernet, Wi-Fi, Hotspot)
try {
    $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }
    foreach ($a in $addrs) {
        $parts = $a.IPAddress.Split('.')
        if ($parts.Length -eq 4) {
            $prefix = "$($parts[0]).$($parts[1]).$($parts[2])."
            if (-not $candidates.Contains($a.IPAddress)) { $candidates.Add($a.IPAddress) }
            
            # IPs frequentes pour les serveurs WAMP en commerce (fixes ou baux bas/hauts)
            foreach ($suffix in @(1, 50, 2, 10, 100, 20, 200, 150, 43, 254)) {
                $testIp = "$prefix$suffix"
                if (-not $candidates.Contains($testIp)) { $candidates.Add($testIp) }
            }
        }
    }
} catch {}

# 4. Verification des candidats
foreach ($ip in $candidates) {
    if (Test-BarPos $ip) {
        Write-Output $ip
        exit 0
    }
}

# Serveur non detecte automatiquement
exit 1
