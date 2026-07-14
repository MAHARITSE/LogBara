// ============================================
// TYPES BAR POS v4.2
// Développeur: MAHARITSE Hiacinthe Bertrand
// ============================================

export interface Societe {
  NOM: string;
  ADRESSE: string;
  TELEPHONE: string;
  EMAIL?: string;
  NIF?: string;
  STAT?: string;
  LOGO_EMOJI: string;
  LOGO_TYPE: 'emoji' | 'image' | 'none';
  LOGO_IMAGE?: string;
  UTILISER_IMPRIMANTE: boolean;
}

export interface Personnel {
  IDPERSONNEL: number;
  NOM: string;
  PRENOM: string;
  LOGIN: string;
  MOT_DE_PASSE: string;
  ROLE: 'Administrateur' | 'Gérant' | 'Caissier' | 'Serveur' | 'Magasinier';
  ACTIF: boolean;
  DERNIERE_CONNEXION?: string;
}

export interface Famille {
  IDFAMILLE: number;
  CODE: string;
  FAMILLE: string;
  COULEUR: string;
  ORDRE: number;
}

export interface Article {
  IDARTICLE: number;
  CODE: string;
  NOM: string;
  DESIGNATION?: string;
  IDFAMILLE: number;
  EMOJI?: string;
  IMAGE?: string;
  PRIX_ACHAT: number;
  PRIX_VENTE: number;
  STOCK: number;
  STOCK_MIN: number;
  CODE_BARRE?: string;
  ACTIF: boolean;
  GERE_STOCK: boolean;
  SAISIE_PRIX_VENTE: boolean;
}

export interface TableR {
  IDTABLE: number;
  NUMERO: number;
  DESCRIPTION: string;
  PLACES: number;
  ETAT: 'Libre' | 'Occupée';
  IDCAISSIER?: number;
}

export interface Client {
  IDCLIENT: number;
  NOM_CLIENT: string;
  TELEPHONE: string;
  ADRESSE: string;
  CREDIT_TOTAL: number;
  DATE_CREATION: string;
}

export interface Fournisseur {
  IDFOURNISSEUR: number;
  NOM: string;
  ADRESSE: string;
  TELEPHONE: string;
  EMAIL?: string;
  NIF?: string;
  STAT?: string;
}

export interface Vente {
  IDVENTE: number;
  NUMERO_FACTURE: string;
  DATE_VENTE: string;
  HEURE: string;
  IDPERSONNEL: number;
  IDTABLE: number | null;
  TYPE: 'Comptoir' | 'Table';
  STATUT: 'En cours' | 'Payée' | 'Annulée';
  TOTAL: number;
  REMISE: number;
  CLOTUREE: boolean;
  IDCLOTURE: number | null;
}

export interface LigneVente {
  IDLIGNEVENTE: number;
  IDVENTE: number;
  IDARTICLE: number;
  QUANTITE: number;
  PRIX_UNITAIRE: number;
  MONTANT: number;
}

export interface Paiement {
  IDPAIEMENT: number;
  DATE_PAIEMENT: string;
  HEURE: string;
  IDVENTE: number | null;
  IDPERSONNEL: number;
  MONTANT: number;
  MODE_PAIEMENT: 'Espèces' | 'Mobile Money' | 'Crédit';
  IDCLIENT?: number;
}

export interface Cloture {
  IDCLOTURE: number;
  DATE_CLOTURE: string;
  HEURE: string;
  IDPERSONNEL: number;
  TOTAL_VENTES: number;
  TOTAL_REMISES: number;
  TOTAL_ESPECES: number;
  TOTAL_MOBILE: number;
  TOTAL_CREDIT: number;
  TOTAL_REMBOURSEMENTS: number;
  NB_VENTES: number;
}

export interface Mouvement {
  IDMOUVEMENT: number;
  DATE_MOUVEMENT: string;
  HEURE: string;
  IDARTICLE: number;
  TYPE: 'Entrée' | 'Sortie' | 'Ajustement';
  QUANTITE: number;
  REFERENCE: string;
  IDFOURNISSEUR?: number;
}

export interface Achat {
  IDACHAT: number;
  DATE_ACHAT: string;
  REFERENCE: string;
  IDFOURNISSEUR: number;
  TOTAL: number;
  OBSERVATION?: string;
  IDPERSONNEL?: number;
  CLOTUREE: boolean;
  IDCLOTURE?: number;
}

export interface LigneAchat {
  IDLIGNEACHAT: number;
  IDACHAT: number;
  IDARTICLE: number;
  QUANTITE: number;
  PRIX_ACHAT: number;
  PRIX_VENTE: number;
  MONTANT: number;
}

export interface Inventaire {
  IDINVENTAIRE: number;
  DATE_INVENTAIRE: string;
  HEURE: string;
  IDPERSONNEL: number;
  OBSERVATION?: string;
  VALIDE: boolean;
}

export interface LigneInventaire {
  IDLIGNEINVENTAIRE: number;
  IDINVENTAIRE: number;
  IDARTICLE: number;
  STOCK_THEORIQUE: number;
  STOCK_PHYSIQUE: number;
  ECART: number;
  CHECKED: boolean;
}

export interface Consommation {
  IDCONSOMMATION: number;
  IDTABLE: number;
  IDARTICLE: number;
  QUANTITE: number;
  PRIX_UNITAIRE: number;
  HEURE: string;
  IDPERSONNEL: number;
}

export interface CartItem {
  IDARTICLE: number;
  NOM: string;
  EMOJI?: string;
  QUANTITE: number;
  PRIX_UNITAIRE: number;
  SAISIE_PRIX_VENTE: boolean;
}

export type Role = 'Administrateur' | 'Gérant' | 'Caissier' | 'Serveur' | 'Magasinier';
export type StorageMode = 'local' | 'mysql';

export type ModuleType = 
  | 'dashboard' | 'caisse' | 'tables' | 'ventes' | 'cloture'
  | 'articles' | 'familles' | 'stock' | 'achats' | 'inventaire'
  | 'fournisseurs' | 'personnel' | 'clients' | 'credits' | 'societe' | 'sauvegarde';
