LOGBARA (BAR POS) v4.3 — INSTALLATION WAMP / MYSQL UNIQUEMENT
==============================================================

Ce dossier est prêt à copier dans WAMP. Toutes les données et toutes les
sessions applicatives sont stockées dans MySQL. Aucun fichier de données JSON
et aucun stockage navigateur ne sont utilisés. L'API PHP échange en XML avec
l'application.

URL de l'application : http://localhost/logbara/
Dossier WAMP :         C:\wamp64\www\logbara\
Base MySQL :           logbara

PREREQUIS
---------
- WampServer 3.x 64 bits
- PHP 8.0 ou supérieur
- MySQL 8.0 ou supérieur (ou MariaDB 10.6+, fourni avec WAMP)
- Extensions PHP PDO, pdo_mysql et SimpleXML (activées par défaut dans WAMP)

INSTALLATION
------------
1. Démarrer WAMP et attendre l'icône verte.

2. Copier CE dossier (wamp_deploy) dans WAMP sous le nom logbara :
   C:\wamp64\www\logbara\
   (le contenu de wamp_deploy va directement dans logbara :
   C:\wamp64\www\logbara\index.html, C:\wamp64\www\logbara\api\, etc.)

3. Ouvrir http://localhost/phpmyadmin

4. Cliquer sur Importer et sélectionner :
   C:\wamp64\www\logbara\sql\logbara.sql

   ATTENTION : ce script recrée la base « logbara ». Sauvegarder une base
   existante avant de réimporter le script d'installation.

5. Configuration WAMP standard (déjà écrite dans api\config.php) :
   - serveur : 127.0.0.1
   - port : 3306
   - base : logbara
   - utilisateur : root
   - mot de passe : vide

   Si votre MySQL/MariaDB utilise un autre compte, modifier api\config.php.

6. Vérifier la connexion MySQL (page de diagnostic) :
   http://localhost/logbara/api/diagnostic.php
   -> le message doit être : « Connexion MySQL réussie. La base LogBara est prête. »

7. Ouvrir l'application :
   http://localhost/logbara/

   Le menu latéral affiche « MySQL connecté — données centralisées ».
   S'il affiche « Mode local — MySQL non connecté », suivre la section
   DÉPANNAGE ci-dessous : le message exact de l'erreur est aussi affiché
   sur l'écran de connexion.

COMPTES INITIAUX
----------------
admin    / admin123   Administrateur
gerant   / gerant123  Gérant
caisse1  / 1234       Caissier
caisse2  / 1234       Caissier
magasin  / 1234       Magasinier
serveur  / 1234       Serveur

Les mots de passe sont hachés dans MySQL. Les modifier après installation.

SAUVEGARDE
----------
Le module Sauvegarde produit un fichier SQL directement depuis MySQL.
Pour restaurer, installer d'abord le schéma logbara.sql puis importer la
sauvegarde dans phpMyAdmin (elle contient la ligne « USE logbara; »).

LANCEUR UNIVERSEL UNIQUE (clientwamp.bat) & IMPRESSION DIRECTE
---------------------------------------------------------
Lanceur universel unique (clientwamp.bat) :
- Ouvre automatiquement http://<serveur>/logbara/ (localhost ou IP réseau).
- Détecte automatiquement si le serveur WAMP tourne en local (localhost) ou sur le réseau (Wi-Fi, Ethernet, Hotspot).
- Gère la mémorisation de l'IP du serveur et le lancement de Chrome/Edge avec --kiosk-printing (impression directe).

Détails :
- Lancer clientwamp.bat sur n'importe quel poste :
  * Si lancé sur le serveur lui-même : détecte automatiquement 'localhost' et se connecte immédiatement.
  * Si lancé sur un poste client (Wi-Fi, Ethernet, Hotspot) : recherche automatiquement l'IP du serveur sur le réseau.
  * Si nécessaire, vous propose la saisie directe de l'IP et la mémorise automatiquement (%LOCALAPPDATA%\LogBara\server_ip.txt).
  * Lance Google Chrome ou Microsoft Edge en mode application avec impression directe (--kiosk-printing) via profil dédié %LOCALAPPDATA%\LogBara\KioskProfile.
  * Pour réinitialiser ou changer l'adresse IP mémorisée : clientwamp.bat --reset  (alias: clientwamp.bat -c)
- clientwamp.bat peut être copié SEUL sur un poste client : le script de détection PowerShell
  est intégré (detect_server.ps1 est utilisé en priorité s'il se trouve à côté).
- En cas d'erreur, la fenêtre reste ouverte et affiche le message au lieu de se fermer.
- Si vous éditez clientwamp.bat, gardez les fins de ligne Windows (CRLF) et aucun accent.

CLOTURE DE CAISSE : RATTACHEMENT DES OPERATIONS (ANTI-VOL)
----------------------------------------------------------
- Chaque vente (et ses lignes), chaque achat (et ses lignes) et chaque
  remboursement est rattaché à UNE clôture (colonne idcloture).
- Une opération saisie APRES la clôture du jour n'entre PAS dans cette clôture :
  elle est reportée automatiquement sur la PROCHAINE clôture (le lendemain).
  L'écran « Caisse déjà clôturée » affiche ces opérations en attente.
- La réimpression d'un ticket de clôture n'affiche que les ventes/achats
  rattachés à cette clôture.
- Côté serveur (API PHP), sauf pour l'Administrateur : une vente, un achat,
  leurs lignes, leurs paiements et les clôtures déjà enregistrées ne peuvent
  plus être modifiés ni supprimés, et on ne peut plus ajouter de ligne à une
  vente ou un achat clôturé.
- Une seule clôture par jour et par caissier. La caisse peut rester ouverte
  plusieurs jours : la clôture suivante regroupe tout ce qui n'a pas été clôturé.
- Les ventes et achats saisis après la clôture restent visibles (Ventes, Achats).

MISE A JOUR D'UNE INSTALLATION EXISTANTE (SANS PERTE DE DONNEES)
----------------------------------------------------------------
1. Sauvegarde : phpMyAdmin > logbara > Exporter (ou menu Sauvegarde).
2. phpMyAdmin > base logbara > Importer > sql/mise_a_jour_v4.3.sql > Exécuter.
   (NE PAS importer logbara.sql : il recrée la base VIDE.)
3. Remplacer index.html et le dossier api dans C:\wamp64\www\logbara.
Le script peut être relancé sans risque. Sans lui, l'API ajoute quand même
les colonnes manquantes automatiquement au premier appel
(paiements.idcloture, articles.alerte_stock, articles.ne_plus_vendre).

DEPANNAGE
---------
- Page blanche ou mode local : ouvrir http://localhost/logbara/api/diagnostic.php
  et suivre son message.
- API inaccessible : vérifier Apache et l'URL http://localhost/logbara/
- Erreur MySQL « Unknown column 'alerte_stock' » : importer sql\mise_a_jour_v4.3.sql
  (ou relancer l'application : la colonne est ajoutée automatiquement).
- Erreur MySQL « Unknown database 'logbara' » : importer sql\logbara.sql dans phpMyAdmin.
- Connexion PDO impossible : activer pdo_mysql dans WAMP.
- XML indisponible : activer SimpleXML dans WAMP.

Support : MAHARITSE Hiacinthe Bertrand — 038 34 092 61
