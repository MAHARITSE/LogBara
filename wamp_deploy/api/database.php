<?php
declare(strict_types=1);

/** @return PDO */
function barpos_database(array $config): PDO
{
    if (!extension_loaded('pdo')) {
        throw new RuntimeException('Extension PHP PDO absente. Activez PDO dans WAMP.');
    }
    if (!extension_loaded('pdo_mysql')) {
        throw new RuntimeException('Extension PHP pdo_mysql absente. Activez pdo_mysql dans WAMP.');
    }

    $database = (string) ($config['database'] ?? 'barpos_db');
    $socket = trim((string) ($config['socket'] ?? ''));
    if ($socket !== '') {
        $dsn = sprintf('mysql:unix_socket=%s;dbname=%s;charset=utf8mb4', $socket, $database);
    } else {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            (string) ($config['host'] ?? '127.0.0.1'),
            max(1, (int) ($config['port'] ?? 3306)),
            $database
        );
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => max(1, (int) ($config['connect_timeout'] ?? 5)),
    ];
    // Cette constante n'existe que lorsque le pilote MySQL est réellement chargé.
    // Le test évite une erreur secondaire qui masquerait le vrai diagnostic WAMP.
    if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
        $options[constant('PDO::MYSQL_ATTR_INIT_COMMAND')] = 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci';
    }

    return new PDO(
        $dsn,
        (string) ($config['username'] ?? 'root'),
        (string) ($config['password'] ?? ''),
        $options
    );
}
