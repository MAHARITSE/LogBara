<?php
declare(strict_types=1);

/**
 * Vérification module par module du déploiement WAMP (API PHP/XML + MySQL).
 *
 * Usage :
 *   php tests/wamp_api_test.php <url_api> [dossier_api]
 *   ex: php tests/wamp_api_test.php http://127.0.0.1:8099/logbara/api/index.php wamp_deploy/api
 *
 * Le script passe en revue TOUS les modules :
 *   diagnostic, sonde de session, authentification, lecture des 17 jeux de
 *   données, cohérence schéma MySQL <-> mappings, écriture par module,
 *   verrous anti-fraude (rôles), sauvegarde SQL, réinitialisation,
 *   déconnexion, et auto-réparation du schéma (articles.alerte_stock)
 *   sur une base ancienne.
 */

$urlApi = $argv[1] ?? '';
$apiDir = $argv[2] ?? 'wamp_deploy/api';
if ($urlApi === '') {
    fwrite(STDERR, "Usage: php tests/wamp_api_test.php <url_api> [dossier_api]\n");
    exit(2);
}
$baseUrl = preg_replace('~/api/index\.php$~', '/', $urlApi);

/** Résout le dossier api/ : relatif au CWD, sinon relatif à la racine du dépôt. */
function resolve_api_dir(string $apiDir): string
{
    if (is_dir($apiDir)) {
        return rtrim($apiDir, '/');
    }
    $candidate = __DIR__ . '/../' . $apiDir;
    return is_dir($candidate) ? rtrim($candidate, '/') : rtrim($apiDir, '/');
}
$apiDir = resolve_api_dir($apiDir);

$cookieJar = tempnam(sys_get_temp_dir(), 'logbara_cookies_');
$testsFailed = 0;
$testsPassed = 0;

function pass(string $name): void
{
    global $testsPassed;
    $testsPassed++;
    echo "  [PASS] $name\n";
}

function fail(string $name, string $detail = ''): void
{
    global $testsFailed;
    $testsFailed++;
    echo "  [FAIL] $name" . ($detail !== '' ? " — $detail" : "") . "\n";
}

function check(bool $ok, string $name, string $detail = ''): bool
{
    if ($ok) {
        pass($name);
    } else {
        fail($name, $detail);
    }
    return $ok;
}

/** Requête POST XML vers l'API. Retourne [réponse, entêtes, statutHTTP, corps]. */
function api_post(string $url, string $xml, string $cookieJar, array $extraHeaders = []): array
{
    $headers = [];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $xml,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_COOKIEFILE => $cookieJar,
        CURLOPT_COOKIEJAR => $cookieJar,
        CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$headers) {
            $headers[] = trim($line);
            return strlen($line);
        },
    ]);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge([
        'Content-Type: application/xml; charset=UTF-8',
        'X-BarPOS-Request: 1',
    ], $extraHeaders));
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $response = null;
    if (is_string($body) && $body !== '') {
        $response = @simplexml_load_string($body);
    }
    return [$response, $headers, $status, is_string($body) ? $body : ''];
}

function xml_request(string $action, string $dataset = '', array $rows = null, array $params = []): string
{
    $datasetAttr = $dataset !== '' ? ' dataset="' . htmlspecialchars($dataset, ENT_XML1) . '"' : '';
    $paramsXml = '';
    foreach ($params as $name => $value) {
        $paramsXml .= '<param name="' . htmlspecialchars($name, ENT_XML1) . '">' . htmlspecialchars((string) $value, ENT_XML1) . '</param>';
    }
    $rowsXml = '';
    if (is_array($rows)) {
        $rowsXml = '<rows>';
        foreach ($rows as $row) {
            $rowsXml .= '<row>';
            foreach ($row as $name => $value) {
                $n = htmlspecialchars((string) $name, ENT_XML1);
                if ($value === null) {
                    $rowsXml .= '<field name="' . $n . '" null="1"/>';
                } elseif (is_bool($value)) {
                    $rowsXml .= '<field name="' . $n . '" type="boolean">' . ($value ? '1' : '0') . '</field>';
                } elseif (is_int($value) || is_float($value)) {
                    $rowsXml .= '<field name="' . $n . '" type="number">' . $value . '</field>';
                } else {
                    $rowsXml .= '<field name="' . $n . '" type="string">' . htmlspecialchars((string) $value, ENT_XML1) . '</field>';
                }
            }
            $rowsXml .= '</row>';
        }
        $rowsXml .= '</rows>';
    }
    return '<?xml version="1.0" encoding="UTF-8"?><request action="' . $action . '"' . $datasetAttr . '><params>' . $paramsXml . '</params>' . $rowsXml . '</request>';
}

/** Ligne(s) renvoyées par l'API sous forme [nomChamp => valeur]. */
function xml_rows(?SimpleXMLElement $response): array
{
    if (!$response || (string) $response['success'] !== '1' || !isset($response->rows)) {
        return [];
    }
    $out = [];
    foreach ($response->rows->row as $rowNode) {
        $row = [];
        foreach ($rowNode->field as $field) {
            $row[(string) $field['name']] = ((string) $field['null'] === '1') ? null : (string) $field;
        }
        $out[] = $row;
    }
    return $out;
}

function response_message(?SimpleXMLElement $response): string
{
    if ($response && isset($response->message)) {
        return (string) $response->message;
    }
    return '';
}

/** Lit un jeu de données via l'API. Retourne [réponse, lignes]. */
function api_read(string $url, string $jar, string $dataset): array
{
    [$response] = api_post($url, xml_request('read', $dataset), $jar);
    return [$response, xml_rows($response)];
}

/** Synchronise un jeu de données : lit l'état courant puis applique $mutate(lignes). */
function api_sync(string $url, string $jar, string $dataset, callable $mutate): array
{
    [, $rows] = api_read($url, $jar, $dataset);
    $rows = $mutate($rows);
    [$response] = api_post($url, xml_request('sync', $dataset, $rows), $jar);
    return [$response, $rows];
}

/** Se connecte avec un compte et vérifie le rôle. */
function api_login(string $url, string $jar, string $login, string $password): array
{
    [$response] = api_post($url, xml_request('authenticate', '', null, ['login' => $login, 'password' => $password]), $jar);
    return [$response, xml_rows($response)];
}

echo "==============================================================\n";
echo " VÉRIFICATION WAMP — API $urlApi\n";
echo "==============================================================\n";

// ---------------------------------------------------------------------------
// T0. Auto-réparation du schéma (base ancienne sans articles.alerte_stock)
// ---------------------------------------------------------------------------
echo "\n[T0] Auto-réparation du schéma (alerte_stock)\n";
if (getenv('TEST_SELF_REPAIR') === '1') {
    $repairOk = false;
    try {
        $testConfig = require $apiDir . '/config.php';
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $testConfig['host'], (int) $testConfig['port'], $testConfig['database']);
        $admin = new PDO($dsn, $testConfig['username'], $testConfig['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $admin->exec('ALTER TABLE articles DROP COLUMN alerte_stock');
        // Un simple « read articles » doit réparer la colonne automatiquement.
        [$resp, $articles] = api_read($urlApi, $cookieJar, 'articles');
        $colBack = $admin->query("SHOW COLUMNS FROM articles LIKE 'alerte_stock'")->fetch();
        $repairOk = (string) $resp['success'] === '1' && count($articles) > 0 && $colBack !== false;
        $admin = null;
    } catch (Throwable $e) {
        echo '   (auto-réparation: ' . $e->getMessage() . ")\n";
    }
    check($repairOk, 'T0 la colonne articles.alerte_stock est recréée automatiquement par l\'API');
} else {
    echo "   (ignoré — TEST_SELF_REPAIR non défini)\n";
}

// ---------------------------------------------------------------------------
// T1. Page de diagnostic
// ---------------------------------------------------------------------------
echo "\n[T1] Page de diagnostic MySQL\n";
$diagBody = (string) @file_get_contents($baseUrl . 'api/diagnostic.php');
check(strpos($diagBody, 'Connexion MySQL réussie') !== false, 'T1 diagnostic.php annonce une connexion MySQL réussie', substr(strip_tags($diagBody), 0, 160));

// ---------------------------------------------------------------------------
// T2. Garde-fous de l'API (GET interdit, en-tête obligatoire)
// ---------------------------------------------------------------------------
echo "\n[T2] Garde-fous de l'API\n";
$getBody = (string) @file_get_contents($urlApi);
check(strpos($getBody, 'success="0"') !== false, 'T2a GET refusé (POST uniquement)');
[$resp] = api_post($urlApi, xml_request('session'), $cookieJar, ['X-BarPOS-Request: 0']);
check($resp !== null && (string) $resp['success'] === '0', 'T2b requête sans l\'en-tête X-BarPOS-Request refusée');

// ---------------------------------------------------------------------------
// T3. Session vierge + mot de passe erroné
// ---------------------------------------------------------------------------
echo "\n[T3] Session et authentification\n";
[$resp, $rows] = api_post($urlApi, xml_request('session'), $cookieJar);
check((string) $resp['success'] === '1' && count($rows) === 0, 'T3a session vierge (aucun utilisateur) avant login');
[$resp] = api_post($urlApi, xml_request('authenticate', '', null, ['login' => 'admin', 'password' => 'MAUVAIS']), $cookieJar);
check((string) $resp['success'] === '1' && count(xml_rows($resp)) === 0, 'T3b mauvais mot de passe rejeté');

// ---------------------------------------------------------------------------
// T4. Connexion administrateur + cookie limité au dossier /logbara/
// ---------------------------------------------------------------------------
echo "\n[T4] Authentification administrateur\n";
[$resp, $headers] = api_login($urlApi, $cookieJar, 'admin', 'admin123');
$adminRows = xml_rows($resp);
check((string) $resp['success'] === '1' && count($adminRows) === 1 && (string) ($adminRows[0]['ROLE'] ?? '') === 'Administrateur', 'T4a login admin/admin123 -> Administrateur');
$cookiePathOk = false;
foreach ($headers as $line) {
    if (stripos($line, 'Set-Cookie:') === 0 && stripos($line, 'path=/logbara/') !== false) {
        $cookiePathOk = true;
    }
}
check($cookiePathOk, 'T4b cookie de session limité au chemin /logbara/', implode(' | ', array_filter($headers, fn ($h) => stripos($h, 'Set-Cookie:') === 0)));
check(($adminRows[0]['MOT_DE_PASSE'] ?? '') === '********', 'T4c mot de passe masqué dans la réponse');

// ---------------------------------------------------------------------------
// T5. Lecture des 17 jeux de données (un par module)
// ---------------------------------------------------------------------------
$allDatasets = [
    'societe' => 'Société', 'personnel' => 'Personnel', 'familles' => 'Familles',
    'articles' => 'Articles', 'tables' => 'Tables', 'clients' => 'Clients',
    'fournisseurs' => 'Fournisseurs', 'clotures' => 'Clôtures', 'ventes' => 'Ventes',
    'lignes_vente' => 'Lignes de vente', 'paiements' => 'Paiements',
    'mouvements' => 'Mouvements de stock', 'achats' => 'Achats',
    'lignes_achat' => 'Lignes d\'achat', 'inventaires' => 'Inventaires',
    'lignes_inventaire' => 'Lignes d\'inventaire', 'consommations' => 'Consommations (tables)',
];
echo "\n[T5] Lecture de chaque module (17 jeux de données)\n";
foreach ($allDatasets as $dataset => $label) {
    [$resp, $rows] = api_read($urlApi, $cookieJar, $dataset);
    if ((string) $resp['success'] === '1') {
        pass("T5 lecture $label ($dataset) — " . count($rows) . " ligne(s)");
    } else {
        check(false, "T5 lecture $label ($dataset)", response_message($resp));
    }
}

// ---------------------------------------------------------------------------
// T6. Cohérence schéma MySQL <-> mappings (toutes les tables / colonnes)
// ---------------------------------------------------------------------------
echo "\n[T6] Cohérence mappings <-> schéma MySQL\n";
try {
    $config = require $apiDir . '/config.php';
    $dsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $config['host'], (int) $config['port']);
    $pdoAdmin = new PDO($dsn, $config['username'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdoAdmin->exec('USE `' . str_replace('`', '', (string) $config['database']) . '`');
    require $apiDir . '/mappings.php';
    $mappings = barpos_mappings();
    $schemaOk = true;
    foreach ($mappings as $dataset => $mapping) {
        $table = $mapping['table'];
        $exists = $pdoAdmin->query('SHOW TABLES LIKE ' . $pdoAdmin->quote($table))->fetch();
        if (!$exists) {
            fail("T6 table $table manquante ($dataset)");
            $schemaOk = false;
            continue;
        }
        $columns = $pdoAdmin->query('SHOW COLUMNS FROM `' . str_replace('`', '', $table) . '`')->fetchAll(PDO::FETCH_COLUMN);
        $missing = array_diff(array_values($mapping['columns']), $columns);
        if ($missing) {
            fail("T6 colonnes manquantes dans $table ($dataset) : " . implode(', ', $missing));
            $schemaOk = false;
        }
    }
    if ($schemaOk) {
        pass('T6 toutes les tables et colonnes des 17 modules existent dans MySQL');
    }
    foreach (['alerte_stock', 'ne_plus_vendre'] as $col) {
        $found = $pdoAdmin->query('SHOW COLUMNS FROM articles LIKE ' . $pdoAdmin->quote($col))->fetch();
        check($found !== false, "T6 articles.$col présente dans la base");
    }
} catch (Throwable $e) {
    fail('T6 contrôle du schéma', $e->getMessage());
}

// ---------------------------------------------------------------------------
// T7. Écriture module par module (administrateur)
// ---------------------------------------------------------------------------
echo "\n[T7] Écriture par module (ajout / contrôle / suppression)\n";
$today = date('Y-m-d');

/** Ajoute une ligne de test (id de sonde imposé), vérifie la relecture, puis la retire. */
function test_roundtrip(string $dataset, array $probe, callable $verify = null): void
{
    global $urlApi, $cookieJar;
    $key = array_key_first($probe);

    [$resp] = api_sync($urlApi, $cookieJar, $dataset, function (array $rows) use ($probe, $key) {
        foreach ($rows as $r) {
            if ((string) $r[$key] === (string) $probe[$key]) {
                throw new RuntimeException("ligne de test $key={$probe[$key]} déjà présente");
            }
        }
        $rows[] = $probe;
        return $rows;
    });
    if ((string) $resp['success'] !== '1') {
        check(false, "T7 $dataset : ajout", response_message($resp));
        return;
    }

    [, $rows] = api_read($urlApi, $cookieJar, $dataset);
    $found = null;
    foreach ($rows as $r) {
        if ((string) $r[$key] === (string) $probe[$key]) {
            $found = $r;
        }
    }
    if ($found === null) {
        check(false, "T7 $dataset : ligne de test absente après ajout");
        return;
    }
    if ($verify !== null && !$verify($found)) {
        check(false, "T7 $dataset : contenu inattendu", json_encode($found, JSON_UNESCAPED_UNICODE));
        return;
    }
    pass("T7 $dataset : ajout + relecture");

    [$resp] = api_sync($urlApi, $cookieJar, $dataset, function (array $rows) use ($key, $probe) {
        return array_values(array_filter($rows, fn ($r) => (string) $r[$key] !== (string) $probe[$key]));
    });
    if ((string) $resp['success'] !== '1') {
        check(false, "T7 $dataset : suppression", response_message($resp));
        return;
    }
    [, $rows] = api_read($urlApi, $cookieJar, $dataset);
    $gone = true;
    foreach ($rows as $r) {
        if ((string) $r[$key] === (string) $probe[$key]) {
            $gone = false;
        }
    }
    check($gone, "T7 $dataset : suppression confirmée");
}

// --- Modules indépendants -------------------------------------------------
test_roundtrip('familles', [
    'IDFAMILLE' => 9001, 'CODE' => 'TST', 'FAMILLE' => 'Test CI', 'COULEUR' => '#123456', 'ORDRE' => 99,
]);
test_roundtrip('articles', [
    'IDARTICLE' => 9001, 'CODE' => 'TST001', 'NOM' => 'Article Test CI', 'DESIGNATION' => null,
    'IDFAMILLE' => 1, 'EMOJI' => '🧪', 'IMAGE' => null, 'PRIX_ACHAT' => 100, 'PRIX_VENTE' => 200,
    'STOCK' => 5, 'STOCK_MIN' => 1, 'CODE_BARRE' => null, 'ACTIF' => true, 'GERE_STOCK' => true,
    'SAISIE_PRIX_VENTE' => false, 'ALERTE_STOCK' => true, 'NE_PLUS_VENDRE' => false,
], function (array $row): bool {
    // Vérifie expressément les colonnes récemment défaillantes
    return ($row['ALERTE_STOCK'] ?? '') === '1' && ($row['NE_PLUS_VENDRE'] ?? '') === '0';
});
test_roundtrip('tables', [
    'IDTABLE' => 9001, 'NUMERO' => 901, 'DESCRIPTION' => 'Test CI', 'PLACES' => 2, 'ETAT' => 'Libre', 'IDCAISSIER' => null,
]);
test_roundtrip('clients', [
    'IDCLIENT' => 9001, 'NOM_CLIENT' => 'Client Test CI', 'TELEPHONE' => '0380000000',
    'ADRESSE' => 'Antananarivo', 'CREDIT_TOTAL' => 0, 'DATE_CREATION' => $today,
]);
test_roundtrip('fournisseurs', [
    'IDFOURNISSEUR' => 9001, 'NOM' => 'Fournisseur Test CI', 'ADRESSE' => '', 'TELEPHONE' => '',
    'EMAIL' => '', 'NIF' => '', 'STAT' => '',
]);
test_roundtrip('mouvements', [
    'IDMOUVEMENT' => 9001, 'DATE_MOUVEMENT' => $today, 'HEURE' => '10:00:00', 'IDARTICLE' => 1,
    'TYPE' => 'Entrée', 'QUANTITE' => 3, 'REFERENCE' => 'TEST-CI', 'IDFOURNISSEUR' => null,
]);
test_roundtrip('paiements', [
    'IDPAIEMENT' => 9001, 'DATE_PAIEMENT' => $today, 'HEURE' => '10:00:00', 'IDVENTE' => null,
    'IDPERSONNEL' => 1, 'MONTANT' => 500, 'MODE_PAIEMENT' => 'Espèces', 'IDCLIENT' => null, 'IDCLOTURE' => null,
]);
test_roundtrip('consommations', [
    'IDCONSOMMATION' => 9001, 'IDTABLE' => 1, 'IDARTICLE' => 1, 'QUANTITE' => 1,
    'PRIX_UNITAIRE' => 4000, 'HEURE' => '10:00:00', 'IDPERSONNEL' => 1,
]);

// --- Modules avec enfants (clés étrangères) : parents d'abord -------------
[$resp] = api_sync($urlApi, $cookieJar, 'ventes', function (array $rows) use ($today) {
    $rows[] = [
        'IDVENTE' => 9001, 'NUMERO_FACTURE' => 'TESTCI-9001', 'DATE_VENTE' => $today, 'HEURE' => '10:00:00',
        'IDPERSONNEL' => 1, 'IDTABLE' => null, 'TYPE' => 'Comptoir', 'STATUT' => 'En cours',
        'TOTAL' => 1000, 'REMISE' => 0, 'CLOTUREE' => false, 'IDCLOTURE' => null,
    ];
    return $rows;
});
check((string) $resp['success'] === '1', 'T7 ventes : vente de test créée', response_message($resp));

[$resp] = api_sync($urlApi, $cookieJar, 'achats', function (array $rows) use ($today) {
    $rows[] = [
        'IDACHAT' => 9001, 'DATE_ACHAT' => $today, 'REFERENCE' => 'ACHAT-CI-9001', 'IDFOURNISSEUR' => 1,
        'TOTAL' => 1000, 'OBSERVATION' => null, 'IDPERSONNEL' => 1, 'CLOTUREE' => false, 'IDCLOTURE' => null,
    ];
    return $rows;
});
check((string) $resp['success'] === '1', 'T7 achats : achat de test créé', response_message($resp));

[$resp] = api_sync($urlApi, $cookieJar, 'inventaires', function (array $rows) use ($today) {
    $rows[] = [
        'IDINVENTAIRE' => 9001, 'DATE_INVENTAIRE' => $today, 'HEURE' => '10:00:00',
        'IDPERSONNEL' => 1, 'OBSERVATION' => 'Test CI', 'VALIDE' => false,
    ];
    return $rows;
});
check((string) $resp['success'] === '1', 'T7 inventaires : inventaire de test créé', response_message($resp));

// Enfants (les parents 9001 existent encore)
test_roundtrip('lignes_vente', [
    'IDLIGNEVENTE' => 9001, 'IDVENTE' => 9001, 'IDARTICLE' => 1, 'QUANTITE' => 2,
    'PRIX_UNITAIRE' => 500, 'MONTANT' => 1000,
]);
test_roundtrip('lignes_achat', [
    'IDLIGNEACHAT' => 9001, 'IDACHAT' => 9001, 'IDARTICLE' => 1, 'QUANTITE' => 2,
    'PRIX_ACHAT' => 3000, 'PRIX_VENTE' => 4000, 'MONTANT' => 6000,
]);
test_roundtrip('lignes_inventaire', [
    'IDLIGNEINVENTAIRE' => 9001, 'IDINVENTAIRE' => 9001, 'IDARTICLE' => 1, 'STOCK_THEORIQUE' => 50,
    'STOCK_PHYSIQUE' => 49, 'ECART' => -1, 'CHECKED' => true,
]);

// Modification d'un parent puis nettoyage (enfants déjà supprimés)
[$resp] = api_sync($urlApi, $cookieJar, 'ventes', function (array $rows) {
    foreach ($rows as $r) {
        if ((string) $r['IDVENTE'] === '9001') {
            $r['TOTAL'] = 2000;
            $r['STATUT'] = 'Payée';
        }
    }
    return $rows;
});
[, $ventesRows] = api_read($urlApi, $cookieJar, 'ventes');
$totalVente = null;
foreach ($ventesRows as $r) {
    if ((string) $r['IDVENTE'] === '9001') {
        $totalVente = $r['TOTAL'];
    }
}
check((string) $resp['success'] === '1' && $totalVente === '2000', 'T7 ventes : modification enregistrée', "total=$totalVente");

[$resp] = api_sync($urlApi, $cookieJar, 'ventes', function (array $rows) {
    return array_values(array_filter($rows, fn ($r) => (string) $r['IDVENTE'] !== '9001'));
});
check((string) $resp['success'] === '1', 'T7 ventes : suppression confirmée', response_message($resp));
[$resp] = api_sync($urlApi, $cookieJar, 'achats', function (array $rows) {
    return array_values(array_filter($rows, fn ($r) => (string) $r['IDACHAT'] !== '9001'));
});
check((string) $resp['success'] === '1', 'T7 achats : suppression confirmée', response_message($resp));
[$resp] = api_sync($urlApi, $cookieJar, 'inventaires', function (array $rows) {
    return array_values(array_filter($rows, fn ($r) => (string) $r['IDINVENTAIRE'] !== '9001'));
});
check((string) $resp['success'] === '1', 'T7 inventaires : suppression confirmée', response_message($resp));

// --- Personnel : masquage + conservation du mot de passe -------------------
[$resp] = api_sync($urlApi, $cookieJar, 'personnel', function (array $rows) {
    $rows[] = [
        'IDPERSONNEL' => 9001, 'NOM' => 'Test', 'PRENOM' => 'CI', 'LOGIN' => 'testci',
        'MOT_DE_PASSE' => 'testci123', 'ROLE' => 'Caissier', 'ACTIF' => true, 'DERNIERE_CONNEXION' => null,
    ];
    return $rows;
});
check((string) $resp['success'] === '1', 'T7 personnel : ajout', response_message($resp));
[, $personnelRows] = api_read($urlApi, $cookieJar, 'personnel');
$testUser = null;
foreach ($personnelRows as $r) {
    if ((string) $r['IDPERSONNEL'] === '9001') {
        $testUser = $r;
    }
}
check($testUser !== null && ($testUser['MOT_DE_PASSE'] ?? '') === '********', 'T7 personnel : mot de passe masqué en lecture');
// Re-sync complet AVEC masque : les mots de passe existants doivent être conservés
[$resp] = api_sync($urlApi, $cookieJar, 'personnel', fn (array $rows) => $rows);
check((string) $resp['success'] === '1', 'T7 personnel : re-sync avec masque accepté', response_message($resp));
[$resp, $loginRows] = api_login($urlApi, $cookieJar, 'testci', 'testci123');
check(count($loginRows) === 1, 'T7 personnel : mot de passe conservé malgré le masque (login testci OK)');
// Retour admin, puis suppression de l'utilisateur de test
api_post($urlApi, xml_request('logout'), $cookieJar);
api_login($urlApi, $cookieJar, 'admin', 'admin123');
[$resp] = api_sync($urlApi, $cookieJar, 'personnel', function (array $rows) {
    return array_values(array_filter($rows, fn ($r) => (string) $r['IDPERSONNEL'] !== '9001'));
});
check((string) $resp['success'] === '1', 'T7 personnel : suppression utilisateur de test', response_message($resp));

// --- Société (ligne unique) : modification puis restauration --------------
[, $societe] = api_read($urlApi, $cookieJar, 'societe');
$oldAdresse = $societe[0]['ADRESSE'] ?? '';
[$resp] = api_sync($urlApi, $cookieJar, 'societe', function (array $rows) {
    $rows[0]['ADRESSE'] = 'Adresse Test CI';
    return $rows;
});
[, $societe2] = api_read($urlApi, $cookieJar, 'societe');
check((string) $resp['success'] === '1' && ($societe2[0]['ADRESSE'] ?? '') === 'Adresse Test CI', 'T7 société : modification enregistrée');
[$resp] = api_sync($urlApi, $cookieJar, 'societe', function (array $rows) use ($oldAdresse) {
    $rows[0]['ADRESSE'] = $oldAdresse;
    return $rows;
});
check((string) $resp['success'] === '1', 'T7 société : restauration', response_message($resp));

// ---------------------------------------------------------------------------
// T8. Verrous anti-fraude (clôture + rôles)
// ---------------------------------------------------------------------------
echo "\n[T8] Verrous anti-fraude et rôles\n";
[$resp] = api_sync($urlApi, $cookieJar, 'clotures', function (array $rows) use ($today) {
    $rows[] = [
        'IDCLOTURE' => 9001, 'DATE_CLOTURE' => $today, 'HEURE' => '23:00:00', 'IDPERSONNEL' => 1,
        'TOTAL_VENTES' => 1000, 'TOTAL_REMISES' => 0, 'TOTAL_ESPECES' => 1000, 'TOTAL_MOBILE' => 0,
        'TOTAL_CREDIT' => 0, 'TOTAL_REMBOURSEMENTS' => 0, 'NB_VENTES' => 1,
    ];
    return $rows;
});
check((string) $resp['success'] === '1', 'T8a clôture de test créée (admin)', response_message($resp));

// Déconnexion admin, connexion caissier
api_post($urlApi, xml_request('logout'), $cookieJar);
[$resp, $loginRows] = api_login($urlApi, $cookieJar, 'caisse1', '1234');
check(count($loginRows) === 1 && ($loginRows[0]['ROLE'] ?? '') === 'Caissier', 'T8b login caisse1/1234 -> Caissier');

// Un caissier ne peut pas modifier une clôture existante (ligne ignorée)
[$resp] = api_sync($urlApi, $cookieJar, 'clotures', function (array $rows) {
    foreach ($rows as $r) {
        if ((string) $r['IDCLOTURE'] === '9001') {
            $r['TOTAL_VENTES'] = 999999;
        }
    }
    return $rows;
});
[, $cloturesRows] = api_read($urlApi, $cookieJar, 'clotures');
$total = null;
foreach ($cloturesRows as $r) {
    if ((string) $r['IDCLOTURE'] === '9001') {
        $total = $r['TOTAL_VENTES'];
    }
}
check($total === '1000', 'T8c clôture verrouillée : modification caissier ignorée', "total=" . var_export($total, true));

// Un caissier ne peut pas supprimer une clôture (la ligne reste)
[$resp] = api_sync($urlApi, $cookieJar, 'clotures', fn (array $rows) => []);
[, $cloturesRows] = api_read($urlApi, $cookieJar, 'clotures');
$stillThere = false;
foreach ($cloturesRows as $r) {
    if ((string) $r['IDCLOTURE'] === '9001') {
        $stillThere = true;
    }
}
check($stillThere, 'T8d clôture verrouillée : suppression caissier impossible');

// Un caissier ne peut pas modifier le personnel
[$resp] = api_sync($urlApi, $cookieJar, 'personnel', fn (array $rows) => $rows);
check($resp !== null && (string) $resp['success'] === '0', 'T8e personnel interdit au caissier', response_message($resp));

// Un caissier ne peut ni sauvegarder ni réinitialiser
[$resp] = api_post($urlApi, xml_request('backup'), $cookieJar);
check($resp !== null && (string) $resp['success'] === '0', 'T8f sauvegarde interdite au caissier');
[$resp] = api_post($urlApi, xml_request('reset'), $cookieJar);
check($resp !== null && (string) $resp['success'] === '0', 'T8g réinitialisation interdite au caissier');

// Retour admin : suppression de la clôture de test
api_post($urlApi, xml_request('logout'), $cookieJar);
api_login($urlApi, $cookieJar, 'admin', 'admin123');
[$resp] = api_sync($urlApi, $cookieJar, 'clotures', function (array $rows) {
    return array_values(array_filter($rows, fn ($r) => (string) $r['IDCLOTURE'] !== '9001'));
});
check((string) $resp['success'] === '1', 'T8h admin : clôture de test supprimée', response_message($resp));

// ---------------------------------------------------------------------------
// T9. Sauvegarde SQL
// ---------------------------------------------------------------------------
echo "\n[T9] Sauvegarde SQL\n";
[$resp] = api_post($urlApi, xml_request('backup'), $cookieJar);
$content = '';
if ($resp && (string) $resp['success'] === '1' && isset($resp->content)) {
    $content = (string) $resp->content;
}
check($content !== '' && strpos($content, 'INSERT INTO') !== false, 'T9a sauvegarde SQL générée');
check(strpos($content, 'USE `logbara`') !== false, 'T9b la sauvegarde cible la base logbara');

// ---------------------------------------------------------------------------
// T10. Réinitialisation (admin) puis déconnexion
// ---------------------------------------------------------------------------
echo "\n[T10] Réinitialisation et déconnexion\n";
[$resp] = api_post($urlApi, xml_request('reset'), $cookieJar);
check((string) $resp['success'] === '1', 'T10a reset opérationnel accepté (admin)', response_message($resp));
[, $ventesRows] = api_read($urlApi, $cookieJar, 'ventes');
check(count($ventesRows) === 0, 'T10b ventes vides après reset');
api_post($urlApi, xml_request('logout'), $cookieJar);
[, $rows] = api_post($urlApi, xml_request('session'), $cookieJar);
check(count($rows) === 0, 'T10c session vide après logout');

// ---------------------------------------------------------------------------
// Bilan
// ---------------------------------------------------------------------------
echo "\n==============================================================\n";
echo " BILAN : $testsPassed OK, $testsFailed ÉCHEC(S)\n";
echo "==============================================================\n";
exit($testsFailed > 0 ? 1 : 0);
