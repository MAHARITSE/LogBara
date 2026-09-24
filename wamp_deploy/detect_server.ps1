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
    [string]$savedIpFile = ""
)

[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

function Test-BarPos([string]$hostOrIp) {
    if ([string]::IsNullOrWhiteSpace($hostOrIp)) { return $false }
    $h = $hostOrIp.Trim()
    
    # Test rapide de connectivite TCP sur le port 80 (timeout 250ms)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect($h, 80, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(250, $false) -or -not $tcp.Connected) {
            $tcp.Close()
            return $false
        }
        $tcp.EndConnect($iar)
        $tcp.Close()
    } catch {
        return $false
    }

    # Test HTTP sur /barpos/
    $url = "http://$h/barpos/"
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Timeout = 1500
        $req.Method = "HEAD"
        $req.AllowAutoRedirect = $true
        $res = $req.GetResponse()
        $code = [int]$res.StatusCode
        $res.Close()
        if ($code -ge 200 -and $code -lt 400) { return $true }
    } catch {
        # Fallback en methode GET si HEAD est refusee par la config Apache
        try {
            $req2 = [System.Net.HttpWebRequest]::Create($url)
            $req2.Timeout = 1800
            $req2.Method = "GET"
            $res2 = $req2.GetResponse()
            $code2 = [int]$res2.StatusCode
            $res2.Close()
            if ($code2 -ge 200 -and $code2 -lt 400) { return $true }
        } catch {}
    }
    return $false
}

# 1. Test localhost / 127.0.0.1 (Machine serveur elle-meme)
if (Test-BarPos "localhost") {
    Write-Output "localhost"
    exit 0
}
if (Test-BarPos "127.0.0.1") {
    Write-Output "127.0.0.1"
    exit 0
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
