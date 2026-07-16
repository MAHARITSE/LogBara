<?php
declare(strict_types=1);

/**
 * Correspondance explicite entre les objets de l'interface et les colonnes MySQL.
 * Aucun nom de table ou de colonne fourni par le navigateur n'est injecté en SQL.
 */
function barpos_mappings(): array
{
    return [
        'societe' => [
            'table' => 'societe',
            'primary_db' => 'id',
            'primary_front' => null,
            'fixed_primary' => 1,
            'columns' => [
                'NOM' => 'nom', 'ADRESSE' => 'adresse', 'TELEPHONE' => 'telephone',
                'EMAIL' => 'email', 'NIF' => 'nif', 'STAT' => 'stat',
                'LOGO_EMOJI' => 'logo_emoji', 'LOGO_TYPE' => 'logo_type',
                'LOGO_IMAGE' => 'logo_image', 'UTILISER_IMPRIMANTE' => 'utiliser_imprimante',
            ],
            'integers' => [], 'decimals' => [],
            'booleans' => ['UTILISER_IMPRIMANTE'],
        ],
        'personnel' => [
            'table' => 'personnel',
            'primary_db' => 'idpersonnel', 'primary_front' => 'IDPERSONNEL',
            'columns' => [
                'IDPERSONNEL' => 'idpersonnel', 'NOM' => 'nom', 'PRENOM' => 'prenom',
                'LOGIN' => 'login', 'MOT_DE_PASSE' => 'mot_de_passe', 'ROLE' => 'role',
                'ACTIF' => 'actif', 'DERNIERE_CONNEXION' => 'derniere_connexion',
            ],
            'integers' => ['IDPERSONNEL'], 'decimals' => [], 'booleans' => ['ACTIF'],
        ],
        'familles' => [
            'table' => 'familles',
            'primary_db' => 'idfamille', 'primary_front' => 'IDFAMILLE',
            'columns' => [
                'IDFAMILLE' => 'idfamille', 'CODE' => 'code', 'FAMILLE' => 'famille',
                'COULEUR' => 'couleur', 'ORDRE' => 'ordre',
            ],
            'integers' => ['IDFAMILLE', 'ORDRE'], 'decimals' => [], 'booleans' => [],
        ],
        'articles' => [
            'table' => 'articles',
            'primary_db' => 'idarticle', 'primary_front' => 'IDARTICLE',
            'columns' => [
                'IDARTICLE' => 'idarticle', 'CODE' => 'code', 'NOM' => 'nom',
                'DESIGNATION' => 'designation', 'IDFAMILLE' => 'idfamille',
                'EMOJI' => 'emoji', 'IMAGE' => 'image', 'PRIX_ACHAT' => 'prix_achat',
                'PRIX_VENTE' => 'prix_vente', 'STOCK' => 'stock', 'STOCK_MIN' => 'stock_min',
                'CODE_BARRE' => 'code_barre', 'ACTIF' => 'actif', 'GERE_STOCK' => 'gere_stock',
                'SAISIE_PRIX_VENTE' => 'saisie_prix_vente',
            ],
            'integers' => ['IDARTICLE', 'IDFAMILLE', 'STOCK', 'STOCK_MIN'],
            'decimals' => ['PRIX_ACHAT', 'PRIX_VENTE'],
            'booleans' => ['ACTIF', 'GERE_STOCK', 'SAISIE_PRIX_VENTE'],
        ],
        'tables' => [
            'table' => 'tables_resto',
            'primary_db' => 'idtable', 'primary_front' => 'IDTABLE',
            'columns' => [
                'IDTABLE' => 'idtable', 'NUMERO' => 'numero', 'DESCRIPTION' => 'description',
                'PLACES' => 'places', 'ETAT' => 'etat', 'IDCAISSIER' => 'idcaissier',
            ],
            'integers' => ['IDTABLE', 'NUMERO', 'PLACES', 'IDCAISSIER'],
            'decimals' => [], 'booleans' => [],
        ],
        'clients' => [
            'table' => 'clients',
            'primary_db' => 'idclient', 'primary_front' => 'IDCLIENT',
            'columns' => [
                'IDCLIENT' => 'idclient', 'NOM_CLIENT' => 'nom_client',
                'TELEPHONE' => 'telephone', 'ADRESSE' => 'adresse',
                'CREDIT_TOTAL' => 'credit_total', 'DATE_CREATION' => 'date_creation',
            ],
            'integers' => ['IDCLIENT'], 'decimals' => ['CREDIT_TOTAL'], 'booleans' => [],
        ],
        'fournisseurs' => [
            'table' => 'fournisseurs',
            'primary_db' => 'idfournisseur', 'primary_front' => 'IDFOURNISSEUR',
            'columns' => [
                'IDFOURNISSEUR' => 'idfournisseur', 'NOM' => 'nom', 'ADRESSE' => 'adresse',
                'TELEPHONE' => 'telephone', 'EMAIL' => 'email', 'NIF' => 'nif', 'STAT' => 'stat',
            ],
            'integers' => ['IDFOURNISSEUR'], 'decimals' => [], 'booleans' => [],
        ],
        'clotures' => [
            'table' => 'clotures',
            'primary_db' => 'idcloture', 'primary_front' => 'IDCLOTURE',
            'columns' => [
                'IDCLOTURE' => 'idcloture', 'DATE_CLOTURE' => 'date_cloture',
                'HEURE' => 'heure', 'IDPERSONNEL' => 'idpersonnel',
                'TOTAL_VENTES' => 'total_ventes', 'TOTAL_REMISES' => 'total_remises',
                'TOTAL_ESPECES' => 'total_especes', 'TOTAL_MOBILE' => 'total_mobile',
                'TOTAL_CREDIT' => 'total_credit', 'TOTAL_REMBOURSEMENTS' => 'total_remboursements',
                'NB_VENTES' => 'nb_ventes',
            ],
            'integers' => ['IDCLOTURE', 'IDPERSONNEL', 'NB_VENTES'],
            'decimals' => ['TOTAL_VENTES', 'TOTAL_REMISES', 'TOTAL_ESPECES', 'TOTAL_MOBILE', 'TOTAL_CREDIT', 'TOTAL_REMBOURSEMENTS'],
            'booleans' => [],
        ],
        'ventes' => [
            'table' => 'ventes',
            'primary_db' => 'idvente', 'primary_front' => 'IDVENTE',
            'columns' => [
                'IDVENTE' => 'idvente', 'NUMERO_FACTURE' => 'numero_facture',
                'DATE_VENTE' => 'date_vente', 'HEURE' => 'heure',
                'IDPERSONNEL' => 'idpersonnel', 'IDTABLE' => 'idtable',
                'TYPE' => 'type_vente', 'STATUT' => 'statut', 'TOTAL' => 'total',
                'REMISE' => 'remise', 'CLOTUREE' => 'cloturee', 'IDCLOTURE' => 'idcloture',
            ],
            'integers' => ['IDVENTE', 'IDPERSONNEL', 'IDTABLE', 'IDCLOTURE'],
            'decimals' => ['TOTAL', 'REMISE'], 'booleans' => ['CLOTUREE'],
        ],
        'lignes_vente' => [
            'table' => 'lignes_vente',
            'primary_db' => 'idlignevente', 'primary_front' => 'IDLIGNEVENTE',
            'columns' => [
                'IDLIGNEVENTE' => 'idlignevente', 'IDVENTE' => 'idvente',
                'IDARTICLE' => 'idarticle', 'QUANTITE' => 'quantite',
                'PRIX_UNITAIRE' => 'prix_unitaire', 'MONTANT' => 'montant',
            ],
            'integers' => ['IDLIGNEVENTE', 'IDVENTE', 'IDARTICLE', 'QUANTITE'],
            'decimals' => ['PRIX_UNITAIRE', 'MONTANT'], 'booleans' => [],
        ],
        'paiements' => [
            'table' => 'paiements',
            'primary_db' => 'idpaiement', 'primary_front' => 'IDPAIEMENT',
            'columns' => [
                'IDPAIEMENT' => 'idpaiement', 'DATE_PAIEMENT' => 'date_paiement',
                'HEURE' => 'heure', 'IDVENTE' => 'idvente', 'IDPERSONNEL' => 'idpersonnel',
                'MONTANT' => 'montant', 'MODE_PAIEMENT' => 'mode_paiement', 'IDCLIENT' => 'idclient',
            ],
            'integers' => ['IDPAIEMENT', 'IDVENTE', 'IDPERSONNEL', 'IDCLIENT'],
            'decimals' => ['MONTANT'], 'booleans' => [],
        ],
        'mouvements' => [
            'table' => 'mouvements',
            'primary_db' => 'idmouvement', 'primary_front' => 'IDMOUVEMENT',
            'columns' => [
                'IDMOUVEMENT' => 'idmouvement', 'DATE_MOUVEMENT' => 'date_mouvement',
                'HEURE' => 'heure', 'IDARTICLE' => 'idarticle', 'TYPE' => 'type_mouvement',
                'QUANTITE' => 'quantite', 'REFERENCE' => 'reference', 'IDFOURNISSEUR' => 'idfournisseur',
            ],
            'integers' => ['IDMOUVEMENT', 'IDARTICLE', 'QUANTITE', 'IDFOURNISSEUR'],
            'decimals' => [], 'booleans' => [],
        ],
        'achats' => [
            'table' => 'achats',
            'primary_db' => 'idachat', 'primary_front' => 'IDACHAT',
            'columns' => [
                'IDACHAT' => 'idachat', 'DATE_ACHAT' => 'date_achat',
                'REFERENCE' => 'reference', 'IDFOURNISSEUR' => 'idfournisseur',
                'TOTAL' => 'total', 'OBSERVATION' => 'observation', 'IDPERSONNEL' => 'idpersonnel',
                'CLOTUREE' => 'cloturee', 'IDCLOTURE' => 'idcloture',
            ],
            'integers' => ['IDACHAT', 'IDFOURNISSEUR', 'IDPERSONNEL', 'IDCLOTURE'],
            'decimals' => ['TOTAL'], 'booleans' => ['CLOTUREE'],
        ],
        'lignes_achat' => [
            'table' => 'lignes_achat',
            'primary_db' => 'idligneachat', 'primary_front' => 'IDLIGNEACHAT',
            'columns' => [
                'IDLIGNEACHAT' => 'idligneachat', 'IDACHAT' => 'idachat',
                'IDARTICLE' => 'idarticle', 'QUANTITE' => 'quantite',
                'PRIX_ACHAT' => 'prix_achat', 'PRIX_VENTE' => 'prix_vente', 'MONTANT' => 'montant',
            ],
            'integers' => ['IDLIGNEACHAT', 'IDACHAT', 'IDARTICLE', 'QUANTITE'],
            'decimals' => ['PRIX_ACHAT', 'PRIX_VENTE', 'MONTANT'], 'booleans' => [],
        ],
        'inventaires' => [
            'table' => 'inventaires',
            'primary_db' => 'idinventaire', 'primary_front' => 'IDINVENTAIRE',
            'columns' => [
                'IDINVENTAIRE' => 'idinventaire', 'DATE_INVENTAIRE' => 'date_inventaire',
                'HEURE' => 'heure', 'IDPERSONNEL' => 'idpersonnel',
                'OBSERVATION' => 'observation', 'VALIDE' => 'valide',
            ],
            'integers' => ['IDINVENTAIRE', 'IDPERSONNEL'], 'decimals' => [], 'booleans' => ['VALIDE'],
        ],
        'lignes_inventaire' => [
            'table' => 'lignes_inventaire',
            'primary_db' => 'idligneinventaire', 'primary_front' => 'IDLIGNEINVENTAIRE',
            'columns' => [
                'IDLIGNEINVENTAIRE' => 'idligneinventaire', 'IDINVENTAIRE' => 'idinventaire',
                'IDARTICLE' => 'idarticle', 'STOCK_THEORIQUE' => 'stock_theorique',
                'STOCK_PHYSIQUE' => 'stock_physique', 'ECART' => 'ecart', 'CHECKED' => 'checked',
            ],
            'integers' => ['IDLIGNEINVENTAIRE', 'IDINVENTAIRE', 'IDARTICLE', 'STOCK_THEORIQUE', 'STOCK_PHYSIQUE', 'ECART'],
            'decimals' => [], 'booleans' => ['CHECKED'],
        ],
        'consommations' => [
            'table' => 'consommations',
            'primary_db' => 'idconsommation', 'primary_front' => 'IDCONSOMMATION',
            'columns' => [
                'IDCONSOMMATION' => 'idconsommation', 'IDTABLE' => 'idtable',
                'IDARTICLE' => 'idarticle', 'QUANTITE' => 'quantite',
                'PRIX_UNITAIRE' => 'prix_unitaire', 'HEURE' => 'heure',
                'IDPERSONNEL' => 'idpersonnel',
            ],
            'integers' => ['IDCONSOMMATION', 'IDTABLE', 'IDARTICLE', 'QUANTITE', 'IDPERSONNEL'],
            'decimals' => ['PRIX_UNITAIRE'], 'booleans' => [],
        ],
    ];
}

function barpos_backup_tables(): array
{
    return [
        'societe', 'personnel', 'familles', 'articles', 'tables_resto',
        'clients', 'fournisseurs', 'clotures', 'ventes', 'lignes_vente',
        'paiements', 'mouvements', 'achats', 'lignes_achat',
        'inventaires', 'lignes_inventaire', 'consommations',
    ];
}
