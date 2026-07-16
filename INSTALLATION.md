# Installation WAMP — Bar POS v4.2 (MySQL uniquement)

**Développeur** : MAHARITSE Hiacinthe Bertrand — 038 34 092 61

Cette version ne possède aucun mode de stockage navigateur. Les articles, ventes, achats, stocks, paramètres et sessions sont enregistrés dans **MySQL** par l’API PHP fournie. L’API utilise XML pour les échanges HTTP : aucun fichier de données JSON n’est utilisé.

## Prérequis

| Composant | Version minimale |
|---|---:|
| WampServer 64 bits | 3.x |
| Apache | 2.4 |
| PHP | 8.0 |
| MySQL | 8.0 |
| Extensions PHP | PDO, pdo_mysql, SimpleXML |

## Installation rapide

1. Démarrer WAMP et attendre que son icône devienne verte.
2. Copier le dossier prêt à déployer :

   ```text
   wamp_deploy  ->  C:\wamp64\www\barpos
   ```

3. Ouvrir <http://localhost/phpmyadmin>.
4. Choisir **Importer**, puis sélectionner :

   ```text
   C:\wamp64\www\barpos\sql\barpos.sql
   ```

   Attention : le script recrée entièrement la base `barpos_db`. Sauvegardez une base existante avant de le réimporter.

5. Avec l’installation WAMP standard (`root` sans mot de passe), aucune modification n’est nécessaire. Sinon, modifier :

   ```text
   C:\wamp64\www\barpos\api\config.php
   ```

6. Tester MySQL avec <http://localhost/barpos/api/diagnostic.php>.
7. Ouvrir l’application : <http://localhost/barpos/>.

## Comptes initiaux

| Login | Mot de passe | Rôle |
|---|---|---|
| admin | admin123 | Administrateur |
| gerant | gerant123 | Gérant |
| caisse1 | 1234 | Caissier |
| caisse2 | 1234 | Caissier |
| magasin | 1234 | Magasinier |
| serveur | 1234 | Serveur |

Les mots de passe sont hachés dans MySQL. Il est recommandé de les modifier après la première connexion.

## Structure du dossier livré

```text
wamp_deploy/
├── index.html                 application compilée, autonome
├── .htaccess                  protections Apache
├── api/
│   ├── index.php              API PHP/XML
│   ├── config.php             paramètres MySQL
│   ├── database.php           connexion PDO
│   ├── mappings.php           correspondance interface/tables
│   └── diagnostic.php         contrôle d’installation
├── sql/
│   └── barpos.sql             schéma et données initiales
└── README_INSTALLATION.txt
```

## Fonctionnement MySQL exclusif

- aucun basculement de mode ;
- aucune persistance métier dans `localStorage` ou `sessionStorage` ;
- sessions applicatives dans la table `app_sessions` ;
- cookie navigateur limité à un jeton opaque `HttpOnly` ;
- écritures SQL préparées avec PDO ;
- mots de passe hachés ;
- export SQL construit directement à partir des tables MySQL.

## Sauvegarde

Dans le module **Sauvegarde**, utiliser **Export SQL**. Le fichier obtenu contient les vraies colonnes MySQL et les mots de passe hachés. Pour le restaurer, l’importer dans phpMyAdmin après avoir installé le schéma `sql/barpos.sql`.

La réinitialisation est réservée à l’administrateur. Elle efface les opérations (ventes, achats, paiements, mouvements, inventaires, clôtures et consommations), remet stocks et crédits à zéro et conserve les comptes et référentiels.

## Dépannage

| Symptôme | Vérification |
|---|---|
| « API PHP inaccessible » | WAMP vert, Apache démarré, URL sous `http://localhost` |
| « Erreur MySQL » | importer `sql/barpos.sql`, puis vérifier `api/config.php` |
| SimpleXML absent | activer l’extension PHP `simplexml` dans WAMP |
| Connexion PDO impossible | activer `pdo_mysql` et vérifier le port MySQL |
| Page blanche | consulter les journaux Apache/PHP de WAMP |
| Diagnostic OK mais login refusé | utiliser un compte initial ou réimporter la base après sauvegarde |

## Développement et reconstruction

Le dossier `wamp_deploy` est déjà compilé. Pour reconstruire `index.html` après modification des sources :

```bash
npm ci
npm run build
```

Copier ensuite le `dist/index.html` généré vers `wamp_deploy/index.html`. Les fichiers PHP et SQL restent ceux du dossier `wamp_deploy`.
