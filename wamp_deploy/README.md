# Déploiement WAMP — Bar POS v4.2

Ce dossier contient tout le nécessaire pour déployer l'application sur WAMP Server.

## Contenu

```
wamp_deploy/
├── index.html          → Application buildée (React + Vite, fichier unique)
├── sql/
│   └── barpos.sql      → Script SQL pour créer la base barpos_db
└── api/
    └── config.php      → Configuration de connexion MySQL

## Installation rapide

1. Copier le contenu de ce dossier dans `C:\wamp64\www\barpos\`
2. Importer `sql/barpos.sql` via phpMyAdmin (http://localhost/phpmyadmin)
3. Accéder à : http://localhost/barpos/

## Modes

- `http://localhost/barpos/` (localStorage, par défaut)
- `http://localhost/barpos/?mode=mysql` (MySQL + PHP API)

## Comptes démo

- admin / admin123
- caisse1 / 1234
