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
    /**
     * IP publique/accessible du serveur (optionnel).
     * Si défini, cette IP sera affichée sur la page de connexion au lieu de l'IP détectée automatiquement.
     * Utile quand le serveur est derrière un reverse proxy, dans Docker, ou en cloud.
     * Exemple: 'server_ip' => '192.168.1.100' ou 'server_ip' => 'mon-domaine.com'
     */
    'server_ip' => '',
];
