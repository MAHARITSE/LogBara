# Rapport de vérification WAMP — LogBara

**Installation vérifiée avec un vrai serveur PHP 8.2 + MySQL** (workflow
`.github/workflows/wamp-verification.yml`), en reproduisant exactement
l'installation WAMP : application copiée dans le sous-dossier `logbara/`,
base `logbara` importée depuis `sql/logbara.sql`, API appelée comme le fait
le navigateur (XML + cookie de session).

Résultat : **tous les tests passent** (0 échec).

## Bugs corrigés

| # | Gravité | Bug | Correction |
|---|---|---|---|
| 1 | **Bloquant** | `store.ts` : définition de `xhr.timeout` sur une requête XHR **synchrone** → exception `InvalidAccessError` avalée par le `try/catch` → la sonde échouait **toujours** → l'application ne passait **jamais** en mode MySQL sous WAMP (reste silencieusement en mode local navigateur). | Timeout supprimé. La sonde analyse désormais la réponse XML (`success="1"`) et mémorise le **message d'erreur exact** de MySQL. |
| 2 | **Bloquant** | `articles.alerte_stock` (colonne requise par `api/mappings.php`) **absente des deux dumps SQL** → dès l'import neuf, toute lecture/écriture d'articles plantait avec « Erreur MySQL ». | Colonne ajoutée dans `sql/logbara.sql` et `wamp_deploy/sql/logbara.sql` ; `ensure_schema()` la recrée automatiquement sur les bases existantes. |
| 3 | Bloquant | `ensure_schema()` sortait immédiatement quand `paiements.idcloture` existait déjà → les colonnes `alerte_stock`/`ne_plus_vendre` n'étaient jamais ajoutées sur les bases récentes. | Chaque évolution de schéma est vérifiée **indépendamment** (cache par requête). |
| 4 | Majeur | Erreurs MySQL **silencieuses** : l'app basculait en mode local sans prévenir (le vrai message était avalé à la connexion et aux enregistrements). | Bandeau orange à l'écran de connexion + badge d'état dans le menu latéral (« MySQL connecté » / « Mode local ») + message réel de l'API affiché. |
| 5 | Majeur | Sauvegarde SQL codée en dur sur `USE barpos_db;` (faux après renommage). | Nom de base lu dynamiquement (`SELECT DATABASE()`). |
| 6 | Mineur | Base `barpos_db` incohérente avec le dossier `logbara`. | Base renommée **`logbara`** partout (config, dumps, sauvegarde, documentation). |

## Vérification module par module (17 jeux de données)

| Module | Lecture | Écriture | Verrou anti-fraude |
|---|:-:|:-:|:-:|
| Société | ✓ | modification + restauration ✓ | — |
| Personnel | ✓ | ajout, masque `********`, mot de passe conservé, suppression ✓ | interdit au caissier ✓ |
| Familles | ✓ | ajout/suppression ✓ | — |
| Articles | ✓ (avec `alerte_stock` + `ne_plus_vendre`) ✓ | ✓ | — |
| Tables | ✓ | ✓ | — |
| Clients | ✓ | ✓ | — |
| Fournisseurs | ✓ | ✓ | ✓ |
| Clôtures | ✓ | création admin ✓ | modification et suppression caissier **impossibles** ✓ |
| Ventes | ✓ | création, modification, suppression ✓ | — |
| Lignes de vente | ✓ | ✓ | — |
| Paiements | ✓ | ✓ | — |
| Mouvements de stock | ✓ | ✓ | — |
| Achats | ✓ | ✓ | — |
| Lignes d'achat | ✓ | ✓ | — |
| Inventaires | ✓ | ✓ | — |
| Lignes d'inventaire | ✓ | ✓ | — |
| Consommations (tables) | ✓ | ✓ | ✓ |

Contrôles transverses également vérifiés :

- **Diagnostic** : `http://localhost/logbara/api/diagnostic.php` répond « Connexion MySQL réussie. La base LogBara est prête. »
- **Authentification** : `admin/admin123` → Administrateur ; mauvais mot de passe rejeté ; mots de passe **jamais** renvoyés en clair (`********`).
- **Cookie de session** : limité au chemin `/logbara/` (multi-applications possible sur le même WAMP).
- **Cohérence mappings ↔ schéma** : chaque table et colonne de `api/mappings.php` existe dans MySQL (contrôle automatique).
- **Auto-réparation** : sur une base ancienne sans `alerte_stock`, la colonne est recréée par l'API au premier appel.
- **Sauvegarde SQL** : générée avec `USE \`logbara\`;` + INSERT complets.
- **Réinitialisation** : réservée à l'admin ; ventes vides après reset ; déconnexion propre.
- **Bundle front** : reconstruit (`wamp_deploy/index.html`), appels API 100 % relatifs → fonctionne dans **tout** sous-dossier (`/logbara/`, `/barpos/`, racine, IP LAN).

## Impression (caisse & clôture)

- Impression par poste / utilisateur : case à cocher **« Utiliser l'imprimante »** disponible dans le menu latéral
  (accessible aux caissiers et administrateurs).
- L'impression automatique de la **clôture** respecte le choix du poste : imprimante
  cochée ⇒ impression directe silencieuse ; imprimante non cochée ⇒ ouverture de la
  page d'impression pour choisir l'imprimante.
- Plus aucun « affichage bref » : la fenêtre popup de secours a été supprimée ;
  l'impression se fait dans un iframe invisible retiré uniquement après
  l'événement `afterprint` (avant : retiré à 3 s, ce qui annulait l'impression
  et faisait clignoter la page d'impression).

## MySQL forcé dans wamp_deploy (jamais de mode local)

Le bundle `wamp_deploy/index.html` embarque `window.__BARPOS_USE_API__ = true`
(injecté par `npm run build:wamp`, script `scripts/inject-wamp-flag.mjs`) :

- lectures/écritures EXCLUSIVEMENT via l'API PHP + MySQL ;
- aucun repli localStorage : en cas d'indisponibilité de MySQL, message d'erreur
  affiché (connexion, badge) au lieu du mode local silencieux ;
- pas de connexion possible sur les comptes de démonstration locaux ;
- pas de données de démonstration générées.

## Impression clôture (règle spécifique)

- Imprimante COCHÉE sur le poste -> impression DIRECTE silencieuse (kiosque).
- Imprimante NON COCHÉE -> ouverture de la PAGE D'IMPRESSION (fenêtre du ticket
  avec boîte de dialogue : choix de l'imprimante). Applicable à l'impression
  automatique après clôture ET aux réimpressions.

## Comment relancer cette vérification

```bash
git push   # le workflow GitHub Actions se lance automatiquement
# ou : onglet Actions -> « Vérification WAMP (PHP + MySQL) » -> Run workflow
```

Le workflow démarre MySQL, importe `wamp_deploy/sql/logbara.sql`, sert le
dossier comme Apache le ferait sous `/logbara/`, puis exécute
`tests/wamp_api_test.php` (tests T0 à T10 ci-dessus).
