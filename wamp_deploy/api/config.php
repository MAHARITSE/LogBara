<?php
/**
 * Configuration MySQL de Bar POS.
 * Installation WAMP standard : utilisateur root sans mot de passe.
 * Modifiez ces valeurs si votre serveur MySQL utilise un autre compte.
 */
return [
    'host' => '127.0.0.1',
    'port' => 3306,
    'database' => 'barpos_db',
    'username' => 'root',
    'password' => '',
    'session_hours' => 12,
    'debug' => false,
];
