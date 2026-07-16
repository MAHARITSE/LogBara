<?php
declare(strict_types=1);

header('Content-Type: text/html; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require_once __DIR__ . '/database.php';

$ok = false;
$message = '';
$details = [];

try {
    $config = require __DIR__ . '/config.php';
    $pdo = barpos_database($config);
    $expected = [
        'societe', 'personnel', 'app_sessions', 'familles', 'articles', 'tables_resto',
        'clients', 'fournisseurs', 'clotures', 'ventes', 'lignes_vente', 'paiements',
        'mouvements', 'achats', 'lignes_achat', 'inventaires', 'lignes_inventaire', 'consommations',
    ];
    $found = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $missing = array_values(array_diff($expected, $found));
    if (count($missing) > 0) {
        $message = 'Connexion réussie, mais des tables manquent : ' . implode(', ', $missing);
    } else {
        $ok = true;
        $message = 'Connexion MySQL réussie. La base Bar POS est prête.';
    }
    $details[] = 'Base : ' . $config['database'];
    $details[] = 'Tables trouvées : ' . count($found);
    $details[] = 'Articles : ' . (int) $pdo->query('SELECT COUNT(*) FROM articles')->fetchColumn();
    $details[] = 'Personnel actif : ' . (int) $pdo->query('SELECT COUNT(*) FROM personnel WHERE actif = 1')->fetchColumn();
} catch (Throwable $error) {
    $message = 'Connexion MySQL impossible. Vérifiez WAMP, l’import SQL et api/config.php.';
}

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Diagnostic MySQL — Bar POS</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f3f6fb;color:#172033;margin:0;padding:32px}
    .card{max-width:700px;margin:40px auto;background:#fff;border-radius:18px;padding:28px;box-shadow:0 12px 35px #0d47a11f}
    h1{color:#0d47a1;margin-top:0}.status{padding:16px;border-radius:12px;font-weight:700;background:<?= $ok ? '#e8f7ee;color:#18733b' : '#fff0f0;color:#a51f1f' ?>}
    li{margin:8px 0}a{color:#0d47a1;font-weight:700}
  </style>
</head>
<body>
  <main class="card">
    <h1>Diagnostic MySQL — Bar POS</h1>
    <p class="status"><?= h($message) ?></p>
    <?php if (count($details) > 0): ?>
      <ul><?php foreach ($details as $detail): ?><li><?= h($detail) ?></li><?php endforeach; ?></ul>
    <?php endif; ?>
    <p><a href="../">Ouvrir Bar POS</a></p>
  </main>
</body>
</html>
