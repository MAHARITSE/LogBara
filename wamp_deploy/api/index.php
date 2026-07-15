<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    http_response_code(204);
    exit;
}

/** @param mixed $data */
function respond($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400, ?string $detail = null): void
{
    $result = ['success' => false, 'message' => $message];
    if ($detail !== null) {
        $result['detail'] = $detail;
    }
    respond($result, $status);
}

/** @return array<string, mixed> */
function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    try {
        $value = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        fail('Corps JSON invalide.', 400, $error->getMessage());
    }

    if (!is_array($value)) {
        fail('Le corps de la requête doit être un objet JSON.');
    }
    return $value;
}

/** @return array<string, array{table: string, primary: string}> */
function resources(): array
{
    return [
        'societe' => ['table' => 'societe', 'primary' => 'id'],
        'personnel' => ['table' => 'personnel', 'primary' => 'idpersonnel'],
        'familles' => ['table' => 'familles', 'primary' => 'idfamille'],
        'articles' => ['table' => 'articles', 'primary' => 'idarticle'],
        'tables' => ['table' => 'tables_resto', 'primary' => 'idtable'],
        'clients' => ['table' => 'clients', 'primary' => 'idclient'],
        'fournisseurs' => ['table' => 'fournisseurs', 'primary' => 'idfournisseur'],
        'ventes' => ['table' => 'ventes', 'primary' => 'idvente'],
        'lignes-vente' => ['table' => 'lignes_vente', 'primary' => 'idlignevente'],
        'paiements' => ['table' => 'paiements', 'primary' => 'idpaiement'],
        'clotures' => ['table' => 'clotures', 'primary' => 'idcloture'],
        'mouvements' => ['table' => 'mouvements', 'primary' => 'idmouvement'],
        'achats' => ['table' => 'achats', 'primary' => 'idachat'],
        'lignes-achat' => ['table' => 'lignes_achat', 'primary' => 'idligneachat'],
        'inventaires' => ['table' => 'inventaires', 'primary' => 'idinventaire'],
        'lignes-inventaire' => ['table' => 'lignes_inventaire', 'primary' => 'idligneinventaire'],
        'consommations' => ['table' => 'consommations', 'primary' => 'idconsommation'],
    ];
}

/** @return array<string, string> lower-case input name => real SQL column */
function columns(PDO $pdo, string $table): array
{
    static $cache = [];
    if (isset($cache[$table])) {
        return $cache[$table];
    }

    $result = [];
    foreach ($pdo->query("SHOW COLUMNS FROM `{$table}`")->fetchAll() as $column) {
        $result[strtolower((string) $column['Field'])] = (string) $column['Field'];
    }
    $cache[$table] = $result;
    return $result;
}

/** @param array<string, mixed> $body @return array<string, mixed> */
function validFields(array $body, array $allowed): array
{
    $result = [];
    foreach ($body as $name => $value) {
        $key = strtolower((string) $name);
        if (isset($allowed[$key]) && !in_array($key, ['created_at', 'updated_at'], true)) {
            $result[$allowed[$key]] = $value;
        }
    }
    return $result;
}

try {
    $pdo = db();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $route = trim((string) ($_GET['route'] ?? $_SERVER['PATH_INFO'] ?? ''), '/');
    $segments = $route === '' ? [] : explode('/', $route);

    if ($route === '' || $route === 'health') {
        $pdo->query('SELECT 1');
        respond([
            'success' => true,
            'application' => 'Bar POS',
            'version' => '4.2',
            'database' => DB_NAME,
            'resources' => array_keys(resources()),
        ]);
    }

    if ($segments[0] === 'auth' && ($segments[1] ?? '') === 'login' && $method === 'POST') {
        $body = jsonBody();
        $login = trim((string) ($body['login'] ?? ''));
        $password = (string) ($body['password'] ?? $body['mot_de_passe'] ?? '');
        if ($login === '' || $password === '') {
            fail('Login et mot de passe obligatoires.');
        }

        $statement = $pdo->prepare(
            'SELECT idpersonnel, nom, prenom, login, role, actif, derniere_connexion '
            . 'FROM personnel WHERE LOWER(login) = LOWER(?) AND mot_de_passe = ? AND actif = 1 LIMIT 1'
        );
        $statement->execute([$login, $password]);
        $user = $statement->fetch();
        if (!$user) {
            fail('Identifiants incorrects ou compte désactivé.', 401);
        }
        $pdo->prepare('UPDATE personnel SET derniere_connexion = NOW() WHERE idpersonnel = ?')
            ->execute([$user['idpersonnel']]);
        $user['derniere_connexion'] = date('Y-m-d H:i:s');
        respond(['success' => true, 'data' => $user]);
    }

    $allResources = resources();
    $resourceName = $segments[0] ?? '';
    if (!isset($allResources[$resourceName])) {
        fail('Ressource API inconnue.', 404);
    }

    $definition = $allResources[$resourceName];
    $table = $definition['table'];
    $primary = $definition['primary'];
    // Ne jamais exposer les mots de passe dans les réponses de consultation.
    $select = $resourceName === 'personnel'
        ? 'idpersonnel, nom, prenom, login, role, actif, derniere_connexion, created_at'
        : '*';
    $id = $segments[1] ?? null;
    if ($id !== null && (!ctype_digit($id) || (int) $id < 1)) {
        fail('Identifiant invalide.');
    }

    if ($method === 'GET') {
        if ($id !== null) {
            $statement = $pdo->prepare("SELECT {$select} FROM `{$table}` WHERE `{$primary}` = ? LIMIT 1");
            $statement->execute([(int) $id]);
            $row = $statement->fetch();
            if (!$row) {
                fail('Enregistrement introuvable.', 404);
            }
            respond(['success' => true, 'data' => $row]);
        }

        $limit = min(max((int) ($_GET['limit'] ?? 500), 1), 5000);
        $offset = max((int) ($_GET['offset'] ?? 0), 0);
        $statement = $pdo->prepare("SELECT {$select} FROM `{$table}` ORDER BY `{$primary}` ASC LIMIT :limit OFFSET :offset");
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();
        $rows = $statement->fetchAll();
        respond(['success' => true, 'data' => $rows, 'count' => count($rows), 'limit' => $limit, 'offset' => $offset]);
    }

    $fields = validFields(jsonBody(), columns($pdo, $table));

    if ($method === 'POST' && $id === null) {
        if ($fields === []) {
            fail('Aucun champ valide fourni.');
        }
        $names = array_keys($fields);
        $quoted = array_map(static fn(string $name): string => "`{$name}`", $names);
        $placeholders = array_fill(0, count($names), '?');
        $sql = "INSERT INTO `{$table}` (" . implode(', ', $quoted) . ') VALUES (' . implode(', ', $placeholders) . ')';
        $pdo->prepare($sql)->execute(array_values($fields));
        $newId = isset($fields[$primary]) ? (int) $fields[$primary] : (int) $pdo->lastInsertId();
        respond(['success' => true, 'id' => $newId], 201);
    }

    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        unset($fields[$primary]);
        if ($fields === []) {
            fail('Aucun champ modifiable fourni.');
        }
        $assignments = array_map(static fn(string $name): string => "`{$name}` = ?", array_keys($fields));
        $values = array_values($fields);
        $values[] = (int) $id;
        $statement = $pdo->prepare("UPDATE `{$table}` SET " . implode(', ', $assignments) . " WHERE `{$primary}` = ?");
        $statement->execute($values);
        if ($statement->rowCount() === 0) {
            $check = $pdo->prepare("SELECT 1 FROM `{$table}` WHERE `{$primary}` = ?");
            $check->execute([(int) $id]);
            if (!$check->fetchColumn()) {
                fail('Enregistrement introuvable.', 404);
            }
        }
        respond(['success' => true, 'id' => (int) $id]);
    }

    if ($method === 'DELETE' && $id !== null) {
        $statement = $pdo->prepare("DELETE FROM `{$table}` WHERE `{$primary}` = ?");
        $statement->execute([(int) $id]);
        if ($statement->rowCount() === 0) {
            fail('Enregistrement introuvable.', 404);
        }
        respond(['success' => true]);
    }

    header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    fail('Méthode non autorisée pour cette route.', 405);
} catch (PDOException $error) {
    $status = str_starts_with($error->getCode(), '23') ? 409 : 500;
    fail(
        $status === 409 ? 'Opération impossible à cause de données liées ou dupliquées.' : 'Erreur de connexion ou de requête MySQL.',
        $status,
        $error->getMessage()
    );
} catch (Throwable $error) {
    fail('Erreur interne du serveur.', 500, $error->getMessage());
}
