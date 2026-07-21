BAR POS v4.2 — INSTALLATION WAMP / MYSQL UNIQUEMENT
====================================================

Ce dossier est prêt à copier dans WAMP. Toutes les données et toutes les
sessions applicatives sont stockées dans MySQL. Aucun fichier de données JSON
et aucun stockage navigateur ne sont utilisés. L'API PHP échange en XML avec
l'application.

PREREQUIS
---------
- WampServer 3.x 64 bits
- PHP 8.0 ou supérieur
- MySQL 8.0 ou supérieur
- Extensions PHP PDO, pdo_mysql et SimpleXML

INSTALLATION
------------
1. Démarrer WAMP et attendre l'icône verte.

2. Copier ce dossier sous le nom barpos :
   C:\wamp64\www\barpos\

3. Ouvrir http://localhost/phpmyadmin

4. Cliquer sur Importer et sélectionner :
   C:\wamp64\www\barpos\sql\barpos.sql

   ATTENTION : ce script recrée la base barpos_db. Sauvegarder une base
   existante avant de réimporter le script d'installation.

5. Configuration WAMP standard :
   - serveur : 127.0.0.1
   - port : 3306
   - base : barpos_db
   - utilisateur : root
   - mot de passe : vide

   Si nécessaire, modifier api\config.php.

6. Vérifier l'installation :
   http://localhost/barpos/api/diagnostic.php

7. Ouvrir l'application :
   http://localhost/barpos/

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
Pour restaurer, installer d'abord le schéma barpos.sql puis importer la
sauvegarde dans phpMyAdmin.

DEPANNAGE
---------
- API inaccessible : vérifier Apache et l'URL http://localhost/barpos/
- Erreur MySQL : importer sql\barpos.sql et vérifier api\config.php
- Connexion PDO impossible : activer pdo_mysql dans WAMP
- XML indisponible : activer SimpleXML dans WAMP

Support : MAHARITSE Hiacinthe Bertrand — 038 34 092 61
