BAR POS v4.2 — INSTALLATION WAMP / MYSQL — DOSSIER LogBara
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

   Installation locale fournie : http://[::1]/LogBara/
   Les crochets autour de ::1 sont obligatoires dans une URL IPv6.

2. Copier ce dossier sous le nom LogBara :
   C:\wamp64\www\LogBara\

3. Ouvrir http://localhost/phpmyadmin

4. Cliquer sur Importer et sélectionner :
   C:\wamp64\www\LogBara\sql\barpos.sql

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
   http://[::1]/LogBara/api/diagnostic.php

7. Ouvrir l'application :
   http://[::1]/LogBara/

8. Lanceurs inclus :
   - lancer-serveur.bat : à utiliser sur le PC WAMP ; il ouvre l'adresse
     locale et affiche l'URL réseau à communiquer.
   - lancer-client.bat : à copier sur chaque poste client ; il demande et
     mémorise l'adresse LAN du serveur.
   - lancer-impression-directe.bat : ouvre localement LogBara avec
     l'impression directe Chrome/Edge.

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
- API inaccessible : vérifier Apache et l'URL http://[::1]/LogBara/
- Erreur MySQL : importer sql\barpos.sql et vérifier api\config.php
- Connexion PDO impossible : activer pdo_mysql dans WAMP
- XML indisponible : activer SimpleXML dans WAMP

RÉSEAU
------
`::1` est l’adresse IPv6 de bouclage : elle fonctionne uniquement sur le PC serveur.
Pour un poste client, utilisez une adresse IPv4/IPv6 LAN détectée par lancer-serveur.bat, jamais `::1`.

Support : MAHARITSE Hiacinthe Bertrand — 038 34 092 61
