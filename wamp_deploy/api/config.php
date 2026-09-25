<?php
declare(strict_types=1);

/**
 * Configuration MySQL de Bar POS.
 *
 * Installation WAMP standard : root sans mot de passe sur 127.0.0.1:3306.
 * Si votre WAMP utilise un mot de passe ou un autre port, modifiez les valeurs
 * ci-dessous. Les variables d'environnement BARPOS_DB_* sont aussi acceptées
 * pour les installations automatisées.
 */
function barpos_config_value(string $name, string $default): string
{
    $value = getenv($name);
    return $value === false || trim($value) === '' ? $default : trim($value);
}

return [
    'host' => barpos_config_value('BARPOS_DB_HOST', '127.0.0.1'),
    'port' => max(1, (int) barpos_config_value('BARPOS_DB_PORT', '3306')),
    'database' => barpos_config_value('BARPOS_DB_NAME', 'barpos_db'),
    'username' => barpos_config_value('BARPOS_DB_USER', 'root'),
    'password' => getenv('BARPOS_DB_PASSWORD') === false ? '' : (string) getenv('BARPOS_DB_PASSWORD'),
    // Laissez vide avec WAMP. Utile seulement si MySQL est configuré avec un socket.
    'socket' => barpos_config_value('BARPOS_DB_SOCKET', ''),
    'connect_timeout' => max(1, (int) barpos_config_value('BARPOS_DB_TIMEOUT', '5')),
    'session_hours' => max(1, (int) barpos_config_value('BARPOS_SESSION_HOURS', '12')),
    'debug' => filter_var(barpos_config_value('BARPOS_DEBUG', '0'), FILTER_VALIDATE_BOOLEAN),
];
