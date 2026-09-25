# 📋 PROMPT COMPLET — Bar POS v4.2

## Identité
- **Projet** : Application POS Bar/Restaurant
- **Langue** : Français
- **Devise** : Ariary (Ar)
- **Développeur** : MAHARITSE Hiacinthe Bertrand — 📞 038 34 092 61
- **Base GitHub** : [MAHARITSE/LogBara](https://github.com/MAHARITSE/LogBara)

---

## Stack technique
| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| Charts | Recharts |
| Icônes | Lucide React |
| Export | SheetJS (xlsx) |
| Backend cible | API PHP/XML (WAMP) |
| Base de données | MySQL 8 exclusivement |

---

## Architecture MySQL unique

### Structure cible WAMP
```
C:\wamp64\www\barpos\
├── index.html
├── .htaccess
├── api\
│   ├── config.php
│   ├── database.php
│   ├── mappings.php
│   ├── diagnostic.php
│   └── index.php
└── sql\
    └── barpos.sql
```

### Accès
```
http://localhost/barpos/                       → Application MySQL
http://localhost/barpos/api/diagnostic.php     → Diagnostic MySQL
```
Il n’existe aucun mode local : toutes les données persistantes et les sessions sont enregistrées dans MySQL.

---

## Design
Conserver la page de connexion et la sidebar du dépôt GitHub LogBara :
- gradient bleu foncé → bleu clair
- cercles décoratifs
- logo dynamique (emoji/image/lettre)
- signature développeur en bas du login et de la sidebar

---

## Rôles et accès

| Module | Admin | Gérant | Caissier | Serveur | Magasinier |
|--------|-------|--------|----------|---------|------------|
| Dashboard | ✅ | ✅ | ❌ | ❌ | ❌ |
| Caisse POS | ❌ | ✅ | ✅ | ❌ | ❌ |
| Tables | ✅🆕🗑️ | ✅💳 | 👁️💳 | 👁️ | ❌ |
| Ventes | ✅🗑️ | ✅ | 👁️ | ❌ | ❌ |
| Clôture | 📜 | ✅ | 🔘 | ❌ | ❌ |
| Articles | ✅🗑️ | ✅ | ❌ | ❌ | 👁️ |
| Familles | ✅ | ✅ | ❌ | ❌ | ❌ |
| Stock | ✅ | ✅ | ❌ | ❌ | ✅ |
| Achats | ✅🗑️ | ❌ | ✅ | ❌ | ✅ |
| Inventaire | ✅ | ✅ | ❌ | ❌ | ✅ |
| Fournisseurs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Personnel | ✅ | ❌ | ❌ | ❌ | ❌ |
| Clients | ✅ | ✅ | ❌ | ❌ | ❌ |
| Crédits | ✅ | ✅ | ✅ | ❌ | ❌ |
| Société | ✅ | ✅ | ❌ | ❌ | ❌ |
| Sauvegarde | ✅ | ✅ | ❌ | ❌ | ❌ |

### Comptes par défaut
```
admin / admin123     → Administrateur
gerant / gerant123   → Gérant
caisse1 / 1234       → Caissier
caisse2 / 1234       → Caissier
magasin / 1234       → Magasinier
serveur / 1234       → Serveur
```

---

## Modules — Règles détaillées

### 1. Connexion
Page du GitHub conservée. Signature développeur affichée.

### 2. Dashboard
8 KPIs + 4 graphiques Recharts + top 5 produits + dernières ventes.

### 3. Caisse POS
**Grille articles** :
- Afficher l'**icône emoji** de l'article en grand
- Nom, Prix, Stock (ou ∞)
- **Pas de famille** dans les cards
- Zone agrandie (4 colonnes max, cards plus grandes)
- Badge quantité si au panier
- Badge ✏️ si prix libre

**Panier** (320px) :
- Emoji + nom + prix + quantité +/- + montant
- Remise
- Total bleu gras
- **Pas de tables occupées dans le panier** (ça réduit la hauteur). Les tables sont gérées dans le module Tables
- Bouton Envoyer (table) / Payer (comptoir)

**Logique tables** :
- L'utilisateur peut choisir les articles **AVANT** de sélectionner la table (le panier n'est pas vidé au basculement comptoir/table)
- Quand on sélectionne une table **déjà occupée**, le panier n'est **PAS remplacé** par les consommations existantes. On ajoute de nouveaux articles à livrer
- Le bouton **Envoyer** AJOUTE les articles du panier aux consommations existantes de la table (pas de remplacement)
- Les **tables occupées** sont affichées dans le panier avec leur **total déjà consommé** et un bouton **Payer** pour encaisser directement

**Encaissement** :
- **Montant reçu pré-rempli avec le total**
- 4 modes : Espèces, Mobile Money, Crédit, Mixte
- **Bouton + pour ajouter un client inline** (comme dans Achats pour les fournisseurs) pour éviter les allers-retours
- Impression directe

### 4. Tables
- Admin : CRUD (ajout/suppression), lecture seule sur consommations
- Caissier/Gérant : encaissement de leurs tables
- Serveur : lecture seule
- **Ajout client inline** lors du paiement à crédit (bouton + à côté du select client)

**Retour d'articles (bouton séparé sur la carte table)** :
- Bouton orange **↩** sur chaque table occupée, à côté de 👁️ et Payer
- Ouvre un **modal dédié** (séparé du paiement) avec la liste des articles servis
- Boutons +/- pour sélectionner la quantité à retourner par article
- Résumé des retours affiché avant confirmation
- La confirmation retire les consommations de la table
- Si tous les articles sont retournés, la table revient à "Libre"
- Le modal de paiement reste **simple** (liste, remise, total, mode)

### 5. Ventes
- Stats par caissier
- Annulation (Admin uniquement)
- Caissier ne voit que ses ventes non clôturées

### 6. Clôture
Affiche :
- Total ventes
- **Total remises accordées**
- Espèces / Mobile / Crédits (avec détail par client)
- **Remboursements reçus (avec nom client + montant)**
- Achats du jour
- Espèces attendues

**Après clôture** : Imprime automatiquement un **ticket TCD des ventes du jour** (Tableau Croisé Dynamique) regroupant les articles vendus avec quantités et montants totaux.

### 7. Articles
Toggles cliquables directement dans le tableau : Stocké, Prix libre.

### 8. Familles
CRUD standard avec couleur.

### 9. Achats
- Recherche prédictive : **clavier ET souris**
- Grille éditable : Qté, PA, PV
- Création inline fournisseur
- Masque téléphone : XXX XX XXX XX

### 10. Stock
Entrée / Sortie / Ajustement avec motifs prédéfinis.

### 11. Inventaire

**Architecture deux pages** :
- **Page liste** : historique des inventaires avec statut, bouton "Ouvrir", bouton "Démarrer un inventaire"
- **Page fiche** : quand on ouvre un inventaire, l'historique disparaît et on affiche UNIQUEMENT la fiche détail avec bouton retour

**Fonctionnement** :
- Démarrage avec observation/assistants → ouvre directement la fiche
- **Checkbox "Vérifié"** indépendante du champ stock physique : on peut cocher un article sans changer sa quantité
- Saisie stock physique avec input numérique, auto-sélection au focus
- Écarts colorés (vert positif, rouge négatif, gris zéro)
- KPIs : articles, vérifiés, écarts, valeur écarts
- Compteur vérifié/total affiché

**Règle des 30 jours** :
- L'inventaire est **modifiable pendant 30 jours** après sa date de création
- Un compteur "Xj restant" est affiché dans le statut
- Alerte orange quand il reste ≤ 5 jours
- Après 30 jours : statut **"Expiré"**, inputs et checkbox désactivés, bouton Valider masqué
- Un inventaire **validé** est définitivement en lecture seule
- La validation ajuste les stocks et crée des mouvements d'ajustement

### 12. Fournisseurs
CRUD avec NIF/STAT/Email + masque téléphone.

### 13. Clients
CRUD + suivi crédit + masque téléphone.

### 14. Crédits
- Liste des clients débiteurs avec bouton **Rembourser** sur chaque ligne
- **Pas de section séparée "Enregistrer un remboursement"** (le bouton dans la liste suffit)
- Modal de remboursement : montant pré-rempli avec le crédit, mode paiement, confirmation
- Remboursement = paiement sans vente → alimente la clôture
- **Ticket de remboursement imprimé** automatiquement (nom client, montant, reste)

### 15. Personnel
CRUD avec rôle et activation.

### 16. Société
Logo emoji/image/aucun + masque téléphone + toggle impression.

### 17. Sauvegarde
- Export Excel multi-onglets
- Export SQL (pas de JSON)
- **Réinitialisation avec 3 messages de confirmation** avant validation
- La réinitialisation supprime : ventes, achats, mouvements, stock, inventaires, clôtures, paiements, consommations

---

## Impression

| Document | Mode | Comportement |
|----------|------|-------------|
| Ticket Caisse POS | DIRECT | `window.print()` auto + fermeture fenêtre |
| Ticket Table | DIRECT | `window.print()` auto + fermeture fenêtre |
| Ticket Remboursement | DIRECT | `window.print()` auto + fermeture fenêtre |
| Suivi Table | APERÇU | Fenêtre reste ouverte |
| Facture Vente | APERÇU | Fenêtre reste ouverte |
| Clôture | APERÇU | Fenêtre reste ouverte |
| Récap ventes TCD (après clôture) | APERÇU | Fenêtre reste ouverte |
| Bon d'achat | APERÇU | Fenêtre reste ouverte |

**DIRECT** = `printTicket()` : ouvre fenêtre → `window.print()` → ferme automatiquement. Utilise l'imprimante par défaut du navigateur/OS.

**APERÇU** = `printPreview()` : ouvre fenêtre qui reste affichée pour consultation.

**Format** : 80mm, Courier New 12px, sans signature développeur, sans emoji article.

---

## Saisie
- Masque téléphone : XXX XX XXX XX (10 chiffres)
- Capitalisation auto première lettre (sauf login, email, code-barre)

---

## Signature développeur
Affichée sur :
- ✅ Page de connexion
- ✅ Sidebar

Non affichée sur :
- ❌ Tickets imprimés

```
Développé par MAHARITSE Hiacinthe Bertrand
📞 038 34 092 61
```
