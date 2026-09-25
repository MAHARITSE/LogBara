<?php
declare(strict_types=1);

$asJson = isset($_GET['format']) && strtolower((string) $_GET['format']) === 'json';
if ($asJson) {
    header('Content-Type: application/json; charset=UTF-8');
} else {
    header('Content-Type: text/html; charset=UTF-8');
}
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require_once __DIR__ . '/database.php';

$ok = false;
$message = '';
$details = [];
$checks = [];
$config = [];
$availableColumns = [];

$expectedTables = [
    'societe', 'personnel', 'app_sessions', 'familles', 'articles', 'tables_resto',
    'clients', 'fournisseurs', 'clotures', 'ventes', 'lignes_vente', 'paiements',
    'mouvements', 'achats', 'lignes_achat', 'inventaires', 'lignes_inventaire', 'consommations',
];

$expectedColumns = [
    'societe' => ['id', 'nom', 'adresse', 'telephone', 'email', 'nif', 'stat', 'logo_emoji', 'logo_type', 'logo_image', 'utiliser_imprimante'],
    'personnel' => ['idpersonnel', 'nom', 'prenom', 'login', 'mot_de_passe', 'role', 'actif', 'derniere_connexion'],
    'app_sessions' => ['token_hash', 'idpersonnel', 'expires_at', 'last_seen'],
    'familles' => ['idfamille', 'code', 'famille', 'couleur', 'ordre'],
    'articles' => ['idarticle', 'code', 'nom', 'designation', 'idfamille', 'emoji', 'image', 'prix_achat', 'prix_vente', 'stock', 'stock_min', 'code_barre', 'actif', 'gere_stock', 'saisie_prix_vente'],
    'tables_resto' => ['idtable', 'numero', 'description', 'places', 'etat', 'idcaissier'],
    'clients' => ['idclient', 'nom_client', 'telephone', 'adresse', 'credit_total', 'date_creation'],
    'fournisseurs' => ['idfournisseur', 'nom', 'adresse', 'telephone', 'email', 'nif', 'stat'],
    'clotures' => ['idcloture', 'date_cloture', 'heure', 'idpersonnel', 'total_ventes', 'total_remises', 'total_especes', 'total_mobile', 'total_credit', 'total_remboursements', 'nb_ventes'],
    'ventes' => ['idvente', 'numero_facture', 'date_vente', 'heure', 'idpersonnel', 'idtable', 'type_vente', 'statut', 'total', 'remise', 'cloturee', 'idcloture'],
    'lignes_vente' => ['idlignevente', 'idvente', 'idarticle', 'quantite', 'prix_unitaire', 'montant'],
    'paiements' => ['idpaiement', 'date_paiement', 'heure', 'idvente', 'idpersonnel', 'montant', 'mode_paiement', 'idclient', 'idcloture'],
    'mouvements' => ['idmouvement', 'date_mouvement', 'heure', 'idarticle', 'type_mouvement', 'quantite', 'reference', 'idfournisseur'],
    'achats' => ['idachat', 'date_achat', 'reference', 'idfournisseur', 'total', 'observation', 'idpersonnel', 'cloturee', 'idcloture'],
    'lignes_achat' => ['idligneachat', 'idachat', 'idarticle', 'quantite', 'prix_achat', 'prix_vente', 'montant'],
    'inventaires' => ['idinventaire', 'date_inventaire', 'heure', 'idpersonnel', 'observation', 'valide'],
    'lignes_inventaire' => ['idligneinventaire', 'idinventaire', 'idarticle', 'stock_theorique', 'stock_physique', 'ecart', 'checked'],
    'consommations' => ['idconsommation', 'idtable', 'idarticle', 'quantite', 'prix_unitaire', 'heure', 'idpersonnel'],
];

$moduleTables = [
    'Connexion et sessions' => ['personnel', 'app_sessions'],
    'Dashboard' => ['ventes', 'lignes_vente', 'articles', 'clients', 'familles', 'personnel'],
    'Caisse POS' => ['familles', 'articles', 'tables_resto', 'consommations', 'ventes', 'lignes_vente', 'paiements'],
    'Tables' => ['tables_resto', 'consommations', 'articles', 'ventes', 'lignes_vente', 'paiements'],
    'Ventes' => ['ventes', 'lignes_vente', 'articles', 'tables_resto', 'consommations', 'clotures'],
    'Paiements' => ['paiements', 'ventes', 'lignes_vente', 'articles', 'clients', 'personnel'],
    'Clôture' => ['clotures', 'ventes', 'paiements', 'clients', 'achats', 'lignes_achat', 'articles', 'fournisseurs', 'personnel', 'tables_resto'],
    'Articles' => ['articles', 'familles'],
    'Familles' => ['familles', 'articles'],
    'Stock' => ['articles', 'familles', 'mouvements'],
    'Achats' => ['achats', 'lignes_achat', 'articles', 'mouvements', 'fournisseurs'],
    'Inventaire' => ['inventaires', 'lignes_inventaire', 'articles', 'mouvements'],
    'Fournisseurs' => ['fournisseurs', 'achats'],
    'Personnel' => ['personnel', 'ventes'],
    'Clients' => ['clients'],
    'Crédits' => ['clients', 'paiements'],
    'Société' => ['societe'],
    'Sauvegarde' => $expectedTables,
];

try {
    $config = require __DIR__ . '/config.php';
    $checks[] = [
        'label' => 'Extension PHP PDO',
        'ok' => extension_loaded('pdo'),
        'detail' => extension_loaded('pdo') ? 'active' : 'absente',
    ];
    $checks[] = [
        'label' => 'Extension PHP pdo_mysql',
        'ok' => extension_loaded('pdo_mysql'),
        'detail' => extension_loaded('pdo_mysql') ? 'active' : 'absente',
    ];
    $checks[] = [
        'label' => 'Extension PHP SimpleXML',
        'ok' => extension_loaded('simplexml'),
        'detail' => extension_loaded('simplexml') ? 'active' : 'absente',
    ];

    if (!extension_loaded('pdo_mysql')) {
        throw new RuntimeException('Activez l’extension pdo_mysql dans le menu PHP de WAMP.');
    }
    if (!extension_loaded('simplexml')) {
        throw new RuntimeException('Activez l’extension SimpleXML dans le menu PHP de WAMP.');
    }

    $pdo = barpos_database($config);
    $checks[] = [
        'label' => 'Connexion PDO à MySQL',
        'ok' => true,
        'detail' => 'réussie',
    ];

    $found = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $missingTables = array_values(array_diff($expectedTables, $found));
    $checks[] = [
        'label' => 'Schéma barpos_db',
        'ok' => count($missingTables) === 0,
        'detail' => count($missingTables) === 0
            ? count($found) . ' tables détectées'
            : 'tables manquantes : ' . implode(', ', $missingTables),
    ];

    foreach ($expectedColumns as $table => $columns) {
        if (!in_array($table, $found, true)) {
            continue;
        }
        $quotedTable = '`' . str_replace('`', '``', $table) . '`';
        $actualColumns = $pdo->query('SHOW COLUMNS FROM ' . $quotedTable)->fetchAll(PDO::FETCH_COLUMN);
        $availableColumns[$table] = $actualColumns;
        $missingColumns = array_values(array_diff($columns, $actualColumns));
        $checks[] = [
            'label' => 'Table ' . $table,
            'ok' => count($missingColumns) === 0,
            'detail' => count($missingColumns) === 0
                ? count($actualColumns) . ' colonnes OK'
                : 'colonnes manquantes : ' . implode(', ', $missingColumns),
        ];
    }

    foreach ($moduleTables as $module => $tables) {
        $missing = array_values(array_diff($tables, $found));
        $checks[] = [
            'label' => 'Module ' . $module,
            'ok' => count($missing) === 0,
            'detail' => count($missing) === 0 ? 'tables disponibles' : 'manque : ' . implode(', ', $missing),
        ];
    }

    $details[] = 'Serveur : ' . (string) ($config['host'] ?? '127.0.0.1') . ':' . (string) ($config['port'] ?? 3306);
    $details[] = 'Base : ' . (string) ($config['database'] ?? 'barpos_db');
    $details[] = 'PHP : ' . PHP_VERSION;
    $details[] = 'Tables trouvées : ' . count($found) . ' / ' . count($expectedTables);
    if (in_array('articles', $found, true) && in_array('idarticle', $availableColumns['articles'] ?? [], true)) {
        $details[] = 'Articles : ' . (int) $pdo->query('SELECT COUNT(*) FROM articles')->fetchColumn();
    }
    if (in_array('personnel', $found, true) && in_array('actif', $availableColumns['personnel'] ?? [], true)) {
        $details[] = 'Personnel actif : ' . (int) $pdo->query('SELECT COUNT(*) FROM personnel WHERE actif = 1')->fetchColumn();
    }

    $failedChecks = array_values(array_filter($checks, static fn(array $check): bool => !$check['ok']));
    $ok = count($failedChecks) === 0;
    $message = $ok
        ? 'Connexion MySQL réussie. La base Bar POS et tous les modules sont prêts.'
        : 'Connexion effectuée, mais le schéma Bar POS doit être complété.';
} catch (Throwable $error) {
    $message = 'Connexion MySQL impossible. Vérifiez WAMP, le port, le compte et api/config.php.';
    $checks[] = [
        'label' => 'Erreur détectée',
        'ok' => false,
        'detail' => $error->getMessage(),
    ];
    $details[] = 'PHP : ' . PHP_VERSION;
    if ($config !== []) {
        $details[] = 'Configuration testée : ' . (string) ($config['host'] ?? '127.0.0.1') . ':' . (string) ($config['port'] ?? 3306) . ' / ' . (string) ($config['database'] ?? 'barpos_db');
    }
}

if ($asJson) {
    http_response_code($ok ? 200 : 503);
    echo json_encode([
        'success' => $ok,
        'message' => $message,
        'details' => $details,
        'checks' => $checks,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

$statusBackground = $ok ? '#e8f7ee' : '#fff0f0';
$statusColor = $ok ? '#18733b' : '#a51f1f';
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Diagnostic MySQL — Bar POS</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f3f6fb;color:#172033;margin:0;padding:24px}
    .card{max-width:980px;margin:20px auto;background:#fff;border-radius:18px;padding:28px;box-shadow:0 12px 35px #0d47a11f}
    h1{color:#0d47a1;margin-top:0}.status{padding:16px;border-radius:12px;font-weight:700;background:<?= $statusBackground ?>;color:<?= $statusColor ?>}
    .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;padding:0;list-style:none}
    .meta li{background:#f8fafc;border-radius:10px;padding:10px;font-size:14px}
    table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e7edf5;font-size:14px}th{color:#475569;background:#f8fafc}.ok{color:#18733b;font-weight:700}.ko{color:#a51f1f;font-weight:700}
    a{color:#0d47a1;font-weight:700}.muted{color:#64748b;font-size:13px}
  </style>
</head>
<body>
  <main class="card">
    <h1>Diagnostic MySQL — Bar POS</h1>
    <p class="status"><?= h($message) ?></p>
    <?php if (count($details) > 0): ?><ul class="meta"><?php foreach ($details as $detail): ?><li><?= h($detail) ?></li><?php endforeach; ?></ul><?php endif; ?>
    <h2>Vérification une par une</h2>
    <table>
      <thead><tr><th>Contrôle / module</th><th>État</th><th>Détail</th></tr></thead>
      <tbody>
      <?php foreach ($checks as $check): ?>
        <tr>
          <td><?= h((string) $check['label']) ?></td>
          <td class="<?= $check['ok'] ? 'ok' : 'ko' ?>"><?= $check['ok'] ? 'OK' : 'ERREUR' ?></td>
          <td><?= h((string) $check['detail']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    <p class="muted">Format automatisable : <a href="?format=json">diagnostic.php?format=json</a></p>
    <p><a href="../">Ouvrir Bar POS</a></p>
  </main>
</body>
</html>
