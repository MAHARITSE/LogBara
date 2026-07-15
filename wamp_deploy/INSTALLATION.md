# Bar POS v4.2 — Installation WAMP

**Développeur :** MAHARITSE Hiacinthe Bertrand — **Support :** 038 34 092 61

Le package `barpos_wamp.zip` contient une application React autonome dans un seul `index.html`, une API REST PHP et le script d'installation MySQL.

## Prérequis

- WampServer 3.x 64 bits avec l'icône verte ;
- Apache avec `mod_rewrite` activé ;
- PHP 8.0 ou plus récent, extensions `pdo` et `pdo_mysql` activées ;
- MySQL 8.0 ou MariaDB récent ;
- Chrome, Firefox ou Edge.

## Installation en 3 étapes

### 1. Extraire le package

Extraire **le contenu** de `barpos_wamp.zip` dans :

```text
C:\wamp64\www\barpos\
├── index.html
├── api\
│   ├── config.php
│   ├── index.php
│   └── .htaccess
├── sql\
│   └── barpos.sql
├── INSTALLATION.md
└── PACKAGE.txt
```

Attention à ne pas créer accidentellement `C:\wamp64\www\barpos\wamp_deploy\index.html`.

### 2. Importer la base

1. Ouvrir <http://localhost/phpmyadmin/>.
2. Choisir l'onglet **Importer**.
3. Sélectionner `C:\wamp64\www\barpos\sql\barpos.sql`.
4. Cliquer sur **Importer**.

Le script recrée la base `barpos_db` et insère les données de démonstration. Il supprime donc une éventuelle base `barpos_db` existante : sauvegardez-la avant une réinstallation.

La configuration WAMP par défaut est déjà renseignée dans `api/config.php` :

```php
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'barpos_db');
define('DB_USER', 'root');
define('DB_PASS', '');
```

Modifiez ces valeurs si votre serveur utilise un autre port, utilisateur ou mot de passe.

### 3. Ouvrir Bar POS

- Application : <http://localhost/barpos/>
- Vérification API/MySQL : <http://localhost/barpos/api/>
- Exemple REST : <http://localhost/barpos/api/articles>

La vérification API doit renvoyer un JSON contenant `"success": true`.

## API REST

| Action | Méthode et URL |
|---|---|
| Lister les articles | `GET /barpos/api/articles` |
| Lire l'article 1 | `GET /barpos/api/articles/1` |
| Créer | `POST /barpos/api/articles` |
| Modifier | `PUT /barpos/api/articles/1` |
| Supprimer | `DELETE /barpos/api/articles/1` |
| Connexion | `POST /barpos/api/auth/login` |

Le corps des requêtes `POST`, `PUT` et `PATCH` doit être envoyé en JSON. Les ressources disponibles sont listées par `GET /barpos/api/`.

Si la réécriture Apache n'est pas disponible, utilisez la forme compatible :

```text
http://localhost/barpos/api/index.php?route=articles
```

## Comptes de démonstration

| Login | Mot de passe | Rôle |
|---|---|---|
| `admin` | `admin123` | Administrateur |
| `gerant` | `gerant123` | Gérant |
| `caisse1` | `1234` | Caissier |
| `caisse2` | `1234` | Caissier |
| `magasin` | `1234` | Magasinier |
| `serveur` | `1234` | Serveur |

Changez les mots de passe de démonstration avant toute utilisation réelle.

## Stockage de l'application

L'interface v4.2 fournie fonctionne de manière autonome et conserve ses données dans le `localStorage` du navigateur. La base MySQL et l'API REST sont fournies pour l'intégration serveur, les consultations et développements complémentaires. N'effacez pas les données du site dans le navigateur sans effectuer un export depuis le module **Sauvegarde**.

## Impression

Pour une imprimante thermique 80 mm :

1. installer son pilote et la choisir comme imprimante par défaut ;
2. activer **Utiliser l'imprimante** dans le module Société ;
3. autoriser les fenêtres contextuelles pour `localhost`.

## Dépannage

| Problème | Solution |
|---|---|
| Page blanche | Vérifier que `index.html` est directement dans `www\barpos`, puis vider le cache (`Ctrl+F5`). |
| API : erreur MySQL | Vérifier que WAMP est vert, que `barpos_db` existe et que `api/config.php` correspond à MySQL. |
| `/api/articles` donne une 404 | Activer `mod_rewrite`, redémarrer Apache, ou utiliser `api/index.php?route=articles`. |
| Import SQL refusé | Vérifier les droits de l'utilisateur MySQL et augmenter la limite d'import de phpMyAdmin si nécessaire. |
| Impression bloquée | Autoriser les popups et vérifier l'imprimante par défaut. |
| Données navigateur perdues | Restaurer l'export réalisé depuis le module Sauvegarde. |

## Recréer le package depuis les sources

```bash
npm install
npm run build:wamp
```

Le dossier prêt à copier est généré dans `wamp_deploy/`. Pour produire l'archive depuis Linux/macOS :

```bash
cd wamp_deploy
zip -r ../barpos_wamp.zip .
```
