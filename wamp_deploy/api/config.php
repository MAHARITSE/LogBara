<?php
/**
 * Configuration MySQL de LogBara (Bar POS).
 * Installation WAMP standard : utilisateur root sans mot de passe.
 * Modifiez ces valeurs si votre serveur MySQL utilise un autre compte.
 *
 * IMPORTANT : le nom de la base doit correspondre à celui créé par
 * sql/logbara.sql (base « logbara »).
 */
return [
    'host' => '127.0.0.1',
    'port' => 3306,
    'database' => 'logbara',
    'username' => 'root',
    'password' => '',
    'session_hours' => 12,
    'debug' => false,
];
