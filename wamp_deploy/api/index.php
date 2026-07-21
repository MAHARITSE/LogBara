<?php
declare(strict_types=1);

header('Content-Type: application/xml; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
ob_start();

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/mappings.php';

const BARPOS_COOKIE = 'barpos_session';
const BARPOS_PASSWORD_MASK = '********';

function xml_escape($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function xml_error(string $message): void
{
    if (ob_get_level() > 0) {
        ob_clean();
    }
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<response success="0"><message>' . xml_escape($message) . '</message></response>';
    exit;
}

function xml_success_start(): void
{
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<response success="1">';
}

function value_type(string $frontName, array $mapping): string
{
    if (in_array($frontName, $mapping['booleans'], true)) {
        return 'boolean';
    }
    if (in_array($frontName, $mapping['integers'], true) || in_array($frontName, $mapping['decimals'], true)) {
        return 'number';
    }
    return 'string';
}

function write_rows_xml(array $rows, array $mapping): void
{
    echo '<rows>';
    foreach ($rows as $row) {
        echo '<row>';
        foreach ($mapping['columns'] as $frontName => $dbName) {
            $value = array_key_exists($dbName, $row) ? $row[$dbName] : null;
            if ($mapping['table'] === 'personnel' && $frontName === 'MOT_DE_PASSE') {
                $value = BARPOS_PASSWORD_MASK;
            }

            echo '<field name="' . xml_escape($frontName) . '"';
            if ($value === null) {
                echo ' null="1"/>';
                continue;
            }

            $type = value_type($frontName, $mapping);
            echo ' type="' . $type . '">';
            if ($type === 'boolean') {
                echo ((int) $value === 1) ? '1' : '0';
            } elseif ($type === 'number') {
                echo xml_escape((string) (0 + $value));
            } else {
                echo xml_escape($value);
            }
            echo '</field>';
        }
        echo '</row>';
    }
    echo '</rows>';
}

function request_parameters(SimpleXMLElement $request): array
{
    $parameters = [];
    if (!isset($request->params)) {
        return $parameters;
    }
    foreach ($request->params->param as $param) {
        $name = (string) $param['name'];
        if ($name !== '') {
            $parameters[$name] = (string) $param;
        }
    }
    return $parameters;
}

function request_rows(SimpleXMLElement $request): array
{
    $rows = [];
    if (!isset($request->rows)) {
        return $rows;
    }
    foreach ($request->rows->row as $rowNode) {
        $row = [];
        foreach ($rowNode->field as $field) {
            $name = (string) $field['name'];
            if ($name === '') {
                continue;
            }
            $row[$name] = ((string) $field['null'] === '1') ? null : (string) $field;
        }
        $rows[] = $row;
    }
    return $rows;
}

function cast_input_value($value, string $frontName, array $mapping)
{
    if ($value === null) {
        return null;
    }
    if (in_array($frontName, $mapping['booleans'], true)) {
        return in_array(strtolower((string) $value), ['1', 'true', 'oui'], true) ? 1 : 0;
    }
    if (in_array($frontName, $mapping['integers'], true)) {
        return (int) $value;
    }
    if (in_array($frontName, $mapping['decimals'], true)) {
        return (float) $value;
    }
    return (string) $value;
}

function cookie_path(): string
{
    $script = str_replace('\\\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/api/index.php');
    $path = dirname(dirname($script));
    return ($path === '.' || $path === '\\\\') ? '/' : rtrim($path, '/') . '/';
}

function set_auth_cookie(string $token, int $expiresAt): void
{
    setcookie(BARPOS_COOKIE, $token, [
        'expires' => $expiresAt,
        'path' => cookie_path(),
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function current_user(PDO $pdo): ?array
{
    $token = $_COOKIE[BARPOS_COOKIE] ?? '';
    if (!is_string($token) || strlen($token) < 32) {
        return null;
    }

    $tokenHash = hash('sha256', $token);
    $statement = $pdo->prepare(
        'SELECT p.idpersonnel, p.nom, p.prenom, p.login, p.mot_de_passe, p.role, p.actif, p.derniere_connexion
         FROM app_sessions s
         INNER JOIN personnel p ON p.idpersonnel = s.idpersonnel
         WHERE s.token_hash = ? AND s.expires_at > NOW() AND p.actif = 1
         LIMIT 1'
    );
    $statement->execute([$tokenHash]);
    $user = $statement->fetch();
    if (!$user) {
        return null;
    }

    $pdo->prepare('UPDATE app_sessions SET last_seen = NOW() WHERE token_hash = ?')->execute([$tokenHash]);
    return $user;
}

function can_write_dataset(string $role, string $dataset): bool
{
    if ($role === 'Administrateur') {
        return true;
    }

    $permissions = [
        'Gérant' => [
            'societe', 'familles', 'articles', 'tables', 'clients', 'fournisseurs',
            'ventes', 'lignes_vente', 'paiements', 'clotures', 'mouvements',
            'achats', 'lignes_achat', 'inventaires', 'lignes_inventaire', 'consommations',
        ],
        'Caissier' => [
            'articles', 'tables', 'clients', 'fournisseurs', 'ventes', 'lignes_vente',
            'paiements', 'clotures', 'mouvements', 'achats', 'lignes_achat', 'consommations',
        ],
        'Magasinier' => [
            'articles', 'fournisseurs', 'mouvements', 'achats', 'lignes_achat',
            'inventaires', 'lignes_inventaire',
        ],
        'Serveur' => ['tables', 'consommations'],
    ];

    return in_array($dataset, $permissions[$role] ?? [], true);
}

function read_dataset(PDO $pdo, array $mapping): array
{
    $dbColumns = array_values($mapping['columns']);
    $columns = implode(', ', array_map(function (string $column): string {
        return '`' . $column . '`';
    }, $dbColumns));

    $sql = 'SELECT ' . $columns . ' FROM `' . $mapping['table'] . '`';
    $parameters = [];
    if (isset($mapping['fixed_primary'])) {
        $sql .= ' WHERE `' . $mapping['primary_db'] . '` = ?';
        $parameters[] = $mapping['fixed_primary'];
    } else {
        $sql .= ' ORDER BY `' . $mapping['primary_db'] . '` ASC';
    }

    $statement = $pdo->prepare($sql);
    $statement->execute($parameters);
    return $statement->fetchAll();
}

function existing_password(PDO $pdo, array $mapping, int $id): ?string
{
    $statement = $pdo->prepare(
        'SELECT mot_de_passe FROM `' . $mapping['table'] . '` WHERE `' . $mapping['primary_db'] . '` = ? LIMIT 1'
    );
    $statement->execute([$id]);
    $password = $statement->fetchColumn();
    return $password === false ? null : (string) $password;
}

function sync_dataset(PDO $pdo, array $mapping, array $incomingRows): void
{
    $pdo->beginTransaction();
    try {
        $retainedIds = [];

        foreach ($incomingRows as $incomingRow) {
            $dbRow = [];
            if (isset($mapping['fixed_primary'])) {
                $dbRow[$mapping['primary_db']] = $mapping['fixed_primary'];
            }

            foreach ($mapping['columns'] as $frontName => $dbName) {
                $value = array_key_exists($frontName, $incomingRow) ? $incomingRow[$frontName] : null;

                if ($mapping['table'] === 'personnel' && $frontName === 'MOT_DE_PASSE') {
                    $personnelId = isset($incomingRow['IDPERSONNEL']) ? (int) $incomingRow['IDPERSONNEL'] : 0;
                    if ($value === null || $value === '' || $value === BARPOS_PASSWORD_MASK) {
                        $value = existing_password($pdo, $mapping, $personnelId);
                        if ($value === null) {
                            throw new RuntimeException('Un mot de passe est obligatoire pour chaque nouveau personnel.');
                        }
                    } else {
                        $value = password_hash((string) $value, PASSWORD_DEFAULT);
                    }
                } else {
                    $value = cast_input_value($value, $frontName, $mapping);
                }

                $dbRow[$dbName] = $value;
            }

            $primaryValue = $dbRow[$mapping['primary_db']] ?? null;
            if ($primaryValue === null || (!isset($mapping['fixed_primary']) && (int) $primaryValue <= 0)) {
                throw new RuntimeException('Identifiant de ligne manquant ou invalide.');
            }
            $retainedIds[] = $primaryValue;

            $columns = array_keys($dbRow);
            $quotedColumns = array_map(function (string $column): string {
                return '`' . $column . '`';
            }, $columns);
            $updates = array_values(array_filter($columns, function (string $column) use ($mapping): bool {
                return $column !== $mapping['primary_db'];
            }));
            $updateSql = implode(', ', array_map(function (string $column): string {
                return '`' . $column . '` = VALUES(`' . $column . '`)';
            }, $updates));

            $sql = 'INSERT INTO `' . $mapping['table'] . '` (' . implode(', ', $quotedColumns) . ') VALUES ('
                . implode(', ', array_fill(0, count($columns), '?')) . ')'
                . ($updateSql !== '' ? ' ON DUPLICATE KEY UPDATE ' . $updateSql : '');
            $pdo->prepare($sql)->execute(array_values($dbRow));
        }

        if (!isset($mapping['fixed_primary'])) {
            if (count($retainedIds) === 0) {
                $pdo->exec('DELETE FROM `' . $mapping['table'] . '`');
            } else {
                $placeholders = implode(', ', array_fill(0, count($retainedIds), '?'));
                $delete = $pdo->prepare(
                    'DELETE FROM `' . $mapping['table'] . '` WHERE `' . $mapping['primary_db'] . '` NOT IN (' . $placeholders . ')'
                );
                $delete->execute($retainedIds);
            }
        }

        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function sql_identifier(string $name): string
{
    return '`' . str_replace('`', '``', $name) . '`';
}

function create_sql_backup(PDO $pdo): string
{
    $tables = barpos_backup_tables();
    $lines = [
        '-- ============================================',
        '-- SAUVEGARDE MYSQL BAR POS',
        '-- Generee le ' . date('Y-m-d H:i:s'),
        '-- ============================================',
        'SET NAMES utf8mb4;',
        'SET FOREIGN_KEY_CHECKS = 0;',
        'USE barpos_db;',
        '',
        'DELETE FROM app_sessions;',
    ];

    foreach (array_reverse($tables) as $table) {
        $lines[] = 'DELETE FROM ' . sql_identifier($table) . ';';
    }
    $lines[] = '';

    foreach ($tables as $table) {
        $rows = $pdo->query('SELECT * FROM ' . sql_identifier($table))->fetchAll();
        if (count($rows) === 0) {
            continue;
        }

        $columns = array_keys($rows[0]);
        $columnSql = implode(', ', array_map('sql_identifier', $columns));
        $valueRows = [];
        foreach ($rows as $row) {
            $values = [];
            foreach ($columns as $column) {
                $values[] = $row[$column] === null ? 'NULL' : $pdo->quote((string) $row[$column]);
            }
            $valueRows[] = '(' . implode(', ', $values) . ')';
        }
        $lines[] = 'INSERT INTO ' . sql_identifier($table) . ' (' . $columnSql . ') VALUES';
        $lines[] = implode(",\n", $valueRows) . ';';
        $lines[] = '';
    }

    $lines[] = 'SET FOREIGN_KEY_CHECKS = 1;';
    $lines[] = '-- FIN SAUVEGARDE';
    return implode("\n", $lines) . "\n";
}

function reset_operational_data(PDO $pdo): void
{
    $pdo->beginTransaction();
    try {
        $tables = [
            'consommations', 'lignes_inventaire', 'inventaires', 'lignes_achat',
            'achats', 'mouvements', 'paiements', 'lignes_vente', 'ventes', 'clotures',
        ];
        foreach ($tables as $table) {
            $pdo->exec('DELETE FROM ' . sql_identifier($table));
        }
        $pdo->exec('UPDATE articles SET stock = 0');
        $pdo->exec('UPDATE clients SET credit_total = 0');
        $pdo->exec("UPDATE tables_resto SET etat = 'Libre', idcaissier = NULL");
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        xml_error('Cette API accepte uniquement les requêtes POST de l\'application Bar POS.');
    }
    if (($_SERVER['HTTP_X_BARPOS_REQUEST'] ?? '') !== '1') {
        xml_error('Requête API non autorisée.');
    }

    $body = file_get_contents('php://input');
    if (!is_string($body) || trim($body) === '' || strlen($body) > 25 * 1024 * 1024) {
        xml_error('Corps de requête absent ou trop volumineux.');
    }
    if (stripos($body, '<!DOCTYPE') !== false || stripos($body, '<!ENTITY') !== false) {
        xml_error('Déclaration XML interdite.');
    }

    libxml_use_internal_errors(true);
    $request = simplexml_load_string($body, 'SimpleXMLElement', LIBXML_NONET);
    if (!$request || $request->getName() !== 'request') {
        xml_error('Requête XML invalide.');
    }

    $action = (string) $request['action'];
    $dataset = (string) $request['dataset'];
    $config = require __DIR__ . '/config.php';
    $pdo = barpos_database($config);
    $mappings = barpos_mappings();

    if ($action === 'server_info') {
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $serverAddr = $_SERVER['SERVER_ADDR'] ?? '127.0.0.1';
        $config = require __DIR__ . '/config.php';

        // HTTP_HOST can be [::1] (bracketed IPv6) and can include a port.
        $hostWithoutPort = preg_replace('/^\[([^]]+)\](?::\d+)?$|^([^:]+):\d+$/', '$1$2', $host) ?: $host;
        $isLoopback = $hostWithoutPort === 'localhost'
            || str_starts_with($hostWithoutPort, '127.')
            || $hostWithoutPort === '::1';

        // Determine the display host:
        // 1. If server_ip is configured in config.php, use it (highest priority)
        // 2. If accessed via loopback, try to detect the real LAN IP
        // 3. Otherwise use the HTTP_HOST as-is
        if (!empty($config['server_ip'])) {
            $displayHost = $config['server_ip'];
        } elseif ($isLoopback) {
            // Try to get the real IP from various sources
            $displayHost = getRealServerIp($serverAddr);
        } else {
            $displayHost = $host;
        }

        xml_success_start();
        echo '<rows><row>'
            . '<field name="display_host" type="string">' . xml_escape($displayHost) . '</field>'
            . '<field name="http_host" type="string">' . xml_escape($host) . '</field>'
            . '<field name="server_addr" type="string">' . xml_escape($serverAddr) . '</field>'
            . '</row></rows>';
        echo '</response>';
        exit;
    }

    /**
     * Attempts to determine the real server IP address that clients should use.
     * Checks multiple sources in order of reliability.
     */
    function getRealServerIp(string $fallbackIp): string
    {
        // 1. Check X-Forwarded-For header (set by reverse proxies/load balancers)
        // Take the first IP in the chain (client's original IP)
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $forwardedIps = array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
            $firstIp = $forwardedIps[0];
            if (filter_var($firstIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $firstIp;
            }
        }

        // 2. Check X-Real-IP header (common with nginx reverse proxy)
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            $realIp = trim($_SERVER['HTTP_X_REAL_IP']);
            if (filter_var($realIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $realIp;
            }
        }

        // 3. Check if SERVER_ADDR is a public IP (not private/reserved)
        if (filter_var($fallbackIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return $fallbackIp;
        }

        // 4. Try to get the server's primary non-loopback interface IP
        // This works on Linux by parsing `ip route get` or checking network interfaces
        $detectedIp = detectLanIp();
        if ($detectedIp) {
            return $detectedIp;
        }

        // 5. Fallback to SERVER_ADDR (might be private IP like 192.168.x.x, 10.x.x.x, 172.x.x.x)
        return $fallbackIp;
    }

    /**
     * Attempts to detect the LAN IP by checking network interfaces.
     * Works on Linux systems with `ip` or `ifconfig` command available.
     */
    function detectLanIp(): ?string
    {
        // Try using `ip route get` to find the interface used for external connectivity
        // This returns the source IP that would be used to reach a public IP
        if (function_exists('exec')) {
            // Try to reach a public DNS (8.8.8.8) to see which interface/IP is used
            $output = [];
            $returnCode = 0;
            exec('ip route get 8.8.8.8 2>/dev/null', $output, $returnCode);
            if ($returnCode === 0 && !empty($output)) {
                // Output looks like: "8.8.8.8 via 192.168.1.1 dev eth0 src 192.168.1.100 uid 1000"
                if (preg_match('/\bsrc\s+(\d{1,3}(?:\.\d{1,3}){3})\b/', $output[0], $matches)) {
                    $ip = $matches[1];
                    if (filter_var($ip, FILTER_VALIDATE_IP) && !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_LOOPBACK)) {
                        // It's a private IP but it's the actual LAN IP - return it
                        return $ip;
                    }
                }
            }

            // Fallback: try `hostname -I` to get all IPs
            $output = [];
            exec('hostname -I 2>/dev/null', $output, $returnCode);
            if ($returnCode === 0 && !empty($output)) {
                $ips = array_map('trim', explode(' ', $output[0]));
                foreach ($ips as $ip) {
                    if (filter_var($ip, FILTER_VALIDATE_IP) && !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_LOOPBACK)) {
                        // Return first non-loopback IP
                        return $ip;
                    }
                }
            }

            // Last resort: try ifconfig
            $output = [];
            exec('/sbin/ifconfig 2>/dev/null || /usr/sbin/ifconfig 2>/dev/null', $output, $returnCode);
            if ($returnCode === 0) {
                $content = implode("\n", $output);
                // Match IPv4 addresses, skip loopback
                if (preg_match_all('/inet\s+(\d{1,3}(?:\.\d{1,3}){3})/', $content, $matches)) {
                    foreach ($matches[1] as $ip) {
                        if (filter_var($ip, FILTER_VALIDATE_IP) && !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_LOOPBACK)) {
                            return $ip;
                        }
                    }
                }
            }
        }

        return null;
    }

    if ($action === 'authenticate') {
        $params = request_parameters($request);
        $login = trim($params['login'] ?? '');
        $password = $params['password'] ?? '';

        $statement = $pdo->prepare(
            'SELECT idpersonnel, nom, prenom, login, mot_de_passe, role, actif, derniere_connexion
             FROM personnel WHERE LOWER(login) = LOWER(?) AND actif = 1 LIMIT 1'
        );
        $statement->execute([$login]);
        $user = $statement->fetch();
        $valid = false;
        if ($user) {
            $storedPassword = (string) $user['mot_de_passe'];
            $valid = password_verify($password, $storedPassword);
            if (!$valid && hash_equals($storedPassword, $password)) {
                $valid = true;
                $newHash = password_hash($password, PASSWORD_DEFAULT);
                $pdo->prepare('UPDATE personnel SET mot_de_passe = ? WHERE idpersonnel = ?')
                    ->execute([$newHash, $user['idpersonnel']]);
                $user['mot_de_passe'] = $newHash;
            }
        }

        xml_success_start();
        if ($valid) {
            $pdo->prepare('DELETE FROM app_sessions WHERE expires_at <= NOW()')->execute();
            $pdo->prepare('UPDATE personnel SET derniere_connexion = NOW() WHERE idpersonnel = ?')
                ->execute([$user['idpersonnel']]);
            $user['derniere_connexion'] = date('Y-m-d H:i:s');

            $token = bin2hex(random_bytes(32));
            $expiresAt = time() + max(1, (int) $config['session_hours']) * 3600;
            $expiresSql = date('Y-m-d H:i:s', $expiresAt);
            $pdo->prepare(
                'INSERT INTO app_sessions (token_hash, idpersonnel, expires_at) VALUES (?, ?, ?)'
            )->execute([hash('sha256', $token), $user['idpersonnel'], $expiresSql]);
            set_auth_cookie($token, $expiresAt);
            write_rows_xml([$user], $mappings['personnel']);
        } else {
            write_rows_xml([], $mappings['personnel']);
        }
        echo '</response>';
        exit;
    }

    if ($action === 'logout') {
        $token = $_COOKIE[BARPOS_COOKIE] ?? '';
        if (is_string($token) && $token !== '') {
            $pdo->prepare('DELETE FROM app_sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
        }
        set_auth_cookie('', time() - 3600);
        xml_success_start();
        echo '<rows/></response>';
        exit;
    }

    $user = current_user($pdo);

    if ($action === 'session') {
        xml_success_start();
        write_rows_xml($user ? [$user] : [], $mappings['personnel']);
        echo '</response>';
        exit;
    }

    if ($action === 'read' && $dataset === 'societe') {
        $rows = read_dataset($pdo, $mappings['societe']);
        xml_success_start();
        write_rows_xml($rows, $mappings['societe']);
        echo '</response>';
        exit;
    }

    if (!$user) {
        xml_error('Session expirée. Veuillez vous reconnecter.');
    }

    if ($action === 'read') {
        if (!isset($mappings[$dataset])) {
            xml_error('Jeu de données inconnu.');
        }
        $rows = read_dataset($pdo, $mappings[$dataset]);
        xml_success_start();
        write_rows_xml($rows, $mappings[$dataset]);
        echo '</response>';
        exit;
    }

    if ($action === 'sync') {
        if (!isset($mappings[$dataset])) {
            xml_error('Jeu de données inconnu.');
        }
        if (!can_write_dataset((string) $user['role'], $dataset)) {
            xml_error('Votre rôle ne permet pas de modifier ces données.');
        }
        sync_dataset($pdo, $mappings[$dataset], request_rows($request));
        xml_success_start();
        echo '<rows/></response>';
        exit;
    }

    if ($action === 'backup') {
        if (!in_array($user['role'], ['Administrateur', 'Gérant'], true)) {
            xml_error('Votre rôle ne permet pas de générer une sauvegarde SQL.');
        }
        $backup = create_sql_backup($pdo);
        xml_success_start();
        echo '<content>' . xml_escape($backup) . '</content></response>';
        exit;
    }

    if ($action === 'reset') {
        if ($user['role'] !== 'Administrateur') {
            xml_error('Seul un administrateur peut réinitialiser la base MySQL.');
        }
        reset_operational_data($pdo);
        xml_success_start();
        echo '<rows/></response>';
        exit;
    }

    xml_error('Action API inconnue.');
} catch (PDOException $error) {
    $message = 'Erreur MySQL. Vérifiez la base barpos_db et le fichier api/config.php.';
    if (isset($config) && !empty($config['debug'])) {
        $message .= ' Détail : ' . $error->getMessage();
    }
    xml_error($message);
} catch (Throwable $error) {
    $message = 'Erreur serveur : ' . $error->getMessage();
    xml_error($message);
}