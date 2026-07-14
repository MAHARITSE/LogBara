# 📦 Guide d'installation — Bar POS v4.2

**Développeur** : MAHARITSE Hiacinthe Bertrand — 📞 038 34 092 61

---

## Prérequis

| Composant | Version minimum |
|-----------|----------------|
| WAMP Server | 3.x 64-bit |
| PHP | 8.0+ |
| MySQL | 8.0+ |
| Navigateur | Chrome / Firefox / Edge |

---

## Installation pas à pas

### Étape 1 — WAMP Server
Installer WAMP depuis [wampserver.com](https://www.wampserver.com/).
Démarrer WAMP (icône verte dans la barre des tâches).

### Étape 2 — Dossier du projet
Créer le dossier :
```
C:\wamp64\www\barpos\
```

### Étape 3 — Copier les fichiers
Copier le contenu du build (`dist/`) dans le dossier `barpos` :
```
C:\wamp64\www\barpos\
├── index.html
└── assets\
    ├── index-xxxxx.js
    └── index-xxxxx.css
```

### Étape 4 — Base de données (Mode MySQL)
1. Ouvrir phpMyAdmin : http://localhost/phpmyadmin
2. Importer le fichier `sql/barpos.sql`
3. La base `barpos_db` sera créée automatiquement

### Étape 5 — Configuration API PHP (optionnel)
Créer `api/config.php` :
```php
<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'barpos_db');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');
```

### Étape 6 — Accéder
```
http://localhost/barpos/
```

---

## Modes de fonctionnement

### Mode Local (par défaut)
```
http://localhost/barpos/
```
Les données sont stockées dans le navigateur (localStorage).
Fonctionne sans MySQL, sans serveur PHP.

### Mode MySQL
```
http://localhost/barpos/?mode=mysql
```
Les données sont stockées dans MySQL via l'API PHP.
Nécessite WAMP en fonctionnement + base importée.

### Basculer
```
http://localhost/barpos/?mode=local    → Revenir en mode local
http://localhost/barpos/?mode=mysql    → Passer en mode MySQL
```
Le choix est mémorisé automatiquement.

---

## Comptes de démonstration

| Login | Mot de passe | Rôle |
|-------|-------------|------|
| admin | admin123 | Administrateur |
| gerant | gerant123 | Gérant |
| caisse1 | 1234 | Caissier |
| caisse2 | 1234 | Caissier |
| magasin | 1234 | Magasinier |
| serveur | 1234 | Serveur |

---

## Impression

### Imprimante thermique 80mm
1. Installer le driver de l'imprimante
2. La définir comme imprimante par défaut
3. Activer "Utiliser l'imprimante" dans le module Société
4. Autoriser les popups dans le navigateur

### Format
- Largeur : 80mm
- Police : Courier New 12px
- Mode direct pour les tickets de caisse
- Mode aperçu pour les factures et rapports

---

## Sauvegarde et restauration

### Export
- **Excel** : Fichier multi-onglets (.xlsx)
- **SQL** : Script d'insertion pour phpMyAdmin

### Restauration
Importer le fichier `.sql` dans phpMyAdmin.

### Réinitialisation
Accessible dans le module Sauvegarde.
**3 confirmations requises** avant suppression.
Supprime : ventes, achats, mouvements, stock, inventaires, clôtures, paiements, consommations.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Page blanche | Vérifier WAMP démarré + URL correcte |
| MySQL ne fonctionne pas | Vérifier phpMyAdmin + config.php |
| Impression échoue | Autoriser les popups + vérifier imprimante par défaut |
| Données perdues | Restaurer depuis sauvegarde SQL |
| Page de connexion en boucle | Vider le cache navigateur |

---

## Support
**MAHARITSE Hiacinthe Bertrand**
📞 038 34 092 61
