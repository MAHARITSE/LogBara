-- ============================================
-- BASE DE DONNÉES BAR POS v4.2
-- Pour WAMP Server (MySQL 8)
-- Développeur: MAHARITSE Hiacinthe Bertrand
-- Contact: 038 34 092 61
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Supprimer la base si existe
DROP DATABASE IF EXISTS barpos_db;
CREATE DATABASE barpos_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE barpos_db;

-- ============================================
-- TABLE: societe (paramètres société)
-- ============================================
CREATE TABLE societe (
    id INT PRIMARY KEY DEFAULT 1,
    nom VARCHAR(100) NOT NULL DEFAULT 'Bar POS',
    adresse VARCHAR(255) NOT NULL DEFAULT 'Antananarivo, Madagascar',
    telephone VARCHAR(20) NOT NULL DEFAULT '034 00 000 00',
    email VARCHAR(100) DEFAULT NULL,
    nif VARCHAR(50) DEFAULT NULL,
    stat VARCHAR(50) DEFAULT NULL,
    logo_emoji VARCHAR(10) DEFAULT '🍺',
    logo_type ENUM('emoji', 'image', 'none') DEFAULT 'emoji',
    logo_image LONGTEXT DEFAULT NULL,
    utiliser_imprimante BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- TABLE: personnel (utilisateurs)
-- ============================================
CREATE TABLE personnel (
    idpersonnel INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) DEFAULT '',
    login VARCHAR(50) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    role ENUM('Administrateur', 'Gérant', 'Caissier', 'Serveur', 'Magasinier') NOT NULL,
    actif BOOLEAN DEFAULT TRUE,
    derniere_connexion DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login (login),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: app_sessions (sessions stockées dans MySQL)
-- Le navigateur ne conserve qu'un jeton opaque HttpOnly.
-- ============================================
CREATE TABLE app_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    idpersonnel INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idpersonnel) REFERENCES personnel(idpersonnel) ON DELETE CASCADE,
    INDEX idx_session_personnel (idpersonnel),
    INDEX idx_session_expiration (expires_at)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: familles (catégories d'articles)
-- ============================================
CREATE TABLE familles (
    idfamille INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    famille VARCHAR(100) NOT NULL,
    couleur VARCHAR(10) DEFAULT '#0D47A1',
    ordre INT DEFAULT 0,
    INDEX idx_code (code)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: articles (produits)
-- ============================================
CREATE TABLE articles (
    idarticle INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL,
    designation TEXT DEFAULT NULL,
    idfamille INT NOT NULL,
    emoji VARCHAR(10) DEFAULT '📦',
    image LONGTEXT DEFAULT NULL,
    prix_achat DECIMAL(12,2) DEFAULT 0.00,
    prix_vente DECIMAL(12,2) DEFAULT 0.00,
    stock INT DEFAULT 0,
    stock_min INT DEFAULT 5,
    code_barre VARCHAR(50) DEFAULT NULL,
    actif BOOLEAN DEFAULT TRUE,
    gere_stock BOOLEAN DEFAULT TRUE,
    saisie_prix_vente BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (idfamille) REFERENCES familles(idfamille) ON DELETE RESTRICT,
    INDEX idx_code (code),
    INDEX idx_nom (nom),
    INDEX idx_famille (idfamille),
    INDEX idx_actif (actif)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: tables_resto (tables du restaurant)
-- ============================================
CREATE TABLE tables_resto (
    idtable INT AUTO_INCREMENT PRIMARY KEY,
    numero INT NOT NULL,
    description VARCHAR(100) DEFAULT '',
    places INT DEFAULT 4,
    etat ENUM('Libre', 'Occupée') DEFAULT 'Libre',
    idcaissier INT DEFAULT NULL,
    FOREIGN KEY (idcaissier) REFERENCES personnel(idpersonnel) ON DELETE SET NULL,
    INDEX idx_etat (etat)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: clients
-- ============================================
CREATE TABLE clients (
    idclient INT AUTO_INCREMENT PRIMARY KEY,
    nom_client VARCHAR(100) NOT NULL,
    telephone VARCHAR(20) DEFAULT '',
    adresse VARCHAR(255) DEFAULT '',
    credit_total DECIMAL(12,2) DEFAULT 0.00,
    date_creation DATE DEFAULT (CURRENT_DATE),
    INDEX idx_nom (nom_client),
    INDEX idx_telephone (telephone)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: fournisseurs
-- ============================================
CREATE TABLE fournisseurs (
    idfournisseur INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    adresse VARCHAR(255) DEFAULT '',
    telephone VARCHAR(20) DEFAULT '',
    email VARCHAR(100) DEFAULT '',
    nif VARCHAR(50) DEFAULT '',
    stat VARCHAR(50) DEFAULT '',
    INDEX idx_nom (nom)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: clotures (clôtures de caisse)
-- ============================================
CREATE TABLE clotures (
    idcloture INT AUTO_INCREMENT PRIMARY KEY,
    date_cloture DATE NOT NULL,
    heure TIME NOT NULL,
    idpersonnel INT NOT NULL,
    total_ventes DECIMAL(12,2) DEFAULT 0.00,
    total_remises DECIMAL(12,2) DEFAULT 0.00,
    total_especes DECIMAL(12,2) DEFAULT 0.00,
    total_mobile DECIMAL(12,2) DEFAULT 0.00,
    total_credit DECIMAL(12,2) DEFAULT 0.00,
    total_remboursements DECIMAL(12,2) DEFAULT 0.00,
    nb_ventes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idpersonnel) REFERENCES personnel(idpersonnel) ON DELETE RESTRICT,
    INDEX idx_date (date_cloture),
    INDEX idx_personnel (idpersonnel)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: ventes
-- ============================================
CREATE TABLE ventes (
    idvente INT AUTO_INCREMENT PRIMARY KEY,
    numero_facture VARCHAR(50) UNIQUE NOT NULL,
    date_vente DATE NOT NULL,
    heure TIME NOT NULL,
    idpersonnel INT NOT NULL,
    idtable INT DEFAULT NULL,
    type_vente ENUM('Comptoir', 'Table') DEFAULT 'Comptoir',
    statut ENUM('En cours', 'Payée', 'Annulée') DEFAULT 'En cours',
    total DECIMAL(12,2) DEFAULT 0.00,
    remise DECIMAL(12,2) DEFAULT 0.00,
    cloturee BOOLEAN DEFAULT FALSE,
    idcloture INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idpersonnel) REFERENCES personnel(idpersonnel) ON DELETE RESTRICT,
    FOREIGN KEY (idtable) REFERENCES tables_resto(idtable) ON DELETE SET NULL,
    FOREIGN KEY (idcloture) REFERENCES clotures(idcloture) ON DELETE SET NULL,
    INDEX idx_date (date_vente),
    INDEX idx_personnel (idpersonnel),
    INDEX idx_statut (statut),
    INDEX idx_cloturee (cloturee)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: lignes_vente (détails vente)
-- ============================================
CREATE TABLE lignes_vente (
    idlignevente INT AUTO_INCREMENT PRIMARY KEY,
    idvente INT NOT NULL,
    idarticle INT NOT NULL,
    quantite INT NOT NULL,
    prix_unitaire DECIMAL(12,2) NOT NULL,
    montant DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (idvente) REFERENCES ventes(idvente) ON DELETE CASCADE,
    FOREIGN KEY (idarticle) REFERENCES articles(idarticle) ON DELETE RESTRICT,
    INDEX idx_vente (idvente)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: paiements
-- ============================================
CREATE TABLE paiements (
    idpaiement INT AUTO_INCREMENT PRIMARY KEY,
    date_paiement DATE NOT NULL,
    heure TIME NOT NULL,
    idvente INT DEFAULT NULL,
    idpersonnel INT NOT NULL,
    montant DECIMAL(12,2) NOT NULL,
    mode_paiement ENUM('Espèces', 'Mobile Money', 'Crédit') NOT NULL,
    idclient INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idvente) REFERENCES ventes(idvente) ON DELETE SET NULL,
    FOREIGN KEY (idpersonnel) REFERENCES personnel(idpersonnel) ON DELETE RESTRICT,
    FOREIGN KEY (idclient) REFERENCES clients(idclient) ON DELETE SET NULL,
    INDEX idx_date (date_paiement),
    INDEX idx_vente (idvente),
    INDEX idx_mode (mode_paiement)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: mouvements (stock)
-- ============================================
CREATE TABLE mouvements (
    idmouvement INT AUTO_INCREMENT PRIMARY KEY,
    date_mouvement DATE NOT NULL,
    heure TIME NOT NULL,
    idarticle INT NOT NULL,
    type_mouvement ENUM('Entrée', 'Sortie', 'Ajustement') NOT NULL,
    quantite INT NOT NULL,
    reference VARCHAR(255) DEFAULT '',
    idfournisseur INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idarticle) REFERENCES articles(idarticle) ON DELETE RESTRICT,
    FOREIGN KEY (idfournisseur) REFERENCES fournisseurs(idfournisseur) ON DELETE SET NULL,
    INDEX idx_date (date_mouvement),
    INDEX idx_article (idarticle),
    INDEX idx_type (type_mouvement)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: achats
-- ============================================
CREATE TABLE achats (
    idachat INT AUTO_INCREMENT PRIMARY KEY,
    date_achat DATE NOT NULL,
    reference VARCHAR(50) UNIQUE NOT NULL,
    idfournisseur INT NOT NULL,
    total DECIMAL(12,2) DEFAULT 0.00,
    observation TEXT DEFAULT NULL,
    idpersonnel INT DEFAULT NULL,
    cloturee BOOLEAN DEFAULT FALSE,
    idcloture INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idfournisseur) REFERENCES fournisseurs(idfournisseur) ON DELETE RESTRICT,
    FOREIGN KEY (idpersonnel) REFERENCES personnel(idpersonnel) ON DELETE SET NULL,
    FOREIGN KEY (idcloture) REFERENCES clotures(idcloture) ON DELETE SET NULL,
    INDEX idx_date (date_achat),
    INDEX idx_fournisseur (idfournisseur)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: lignes_achat (détails achat)
-- ============================================
CREATE TABLE lignes_achat (
    idligneachat INT AUTO_INCREMENT PRIMARY KEY,
    idachat INT NOT NULL,
    idarticle INT NOT NULL,
    quantite INT NOT NULL,
    prix_achat DECIMAL(12,2) NOT NULL,
    prix_vente DECIMAL(12,2) NOT NULL,
    montant DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (idachat) REFERENCES achats(idachat) ON DELETE CASCADE,
    FOREIGN KEY (idarticle) REFERENCES articles(idarticle) ON DELETE RESTRICT,
    INDEX idx_achat (idachat)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: inventaires
-- ============================================
CREATE TABLE inventaires (
    idinventaire INT AUTO_INCREMENT PRIMARY KEY,
    date_inventaire DATE NOT NULL,
    heure TIME NOT NULL,
    idpersonnel INT NOT NULL,
    observation TEXT DEFAULT NULL,
    valide BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idpersonnel) REFERENCES personnel(idpersonnel) ON DELETE RESTRICT,
    INDEX idx_date (date_inventaire)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: lignes_inventaire
-- ============================================
CREATE TABLE lignes_inventaire (
    idligneinventaire INT AUTO_INCREMENT PRIMARY KEY,
    idinventaire INT NOT NULL,
    idarticle INT NOT NULL,
    stock_theorique INT NOT NULL,
    stock_physique INT NOT NULL,
    ecart INT NOT NULL,
    checked BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (idinventaire) REFERENCES inventaires(idinventaire) ON DELETE CASCADE,
    FOREIGN KEY (idarticle) REFERENCES articles(idarticle) ON DELETE RESTRICT,
    INDEX idx_inventaire (idinventaire)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: consommations (commandes tables)
-- ============================================
CREATE TABLE consommations (
    idconsommation INT AUTO_INCREMENT PRIMARY KEY,
    idtable INT NOT NULL,
    idarticle INT NOT NULL,
    quantite INT NOT NULL,
    prix_unitaire DECIMAL(12,2) NOT NULL,
    heure TIME NOT NULL,
    idpersonnel INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idtable) REFERENCES tables_resto(idtable) ON DELETE CASCADE,
    FOREIGN KEY (idarticle) REFERENCES articles(idarticle) ON DELETE RESTRICT,
    FOREIGN KEY (idpersonnel) REFERENCES personnel(idpersonnel) ON DELETE RESTRICT,
    INDEX idx_table (idtable)
) ENGINE=InnoDB;

-- ============================================
-- DONNÉES INITIALES
-- ============================================

-- Société
INSERT INTO societe (id, nom, adresse, telephone, email, logo_emoji, logo_type, utiliser_imprimante)
VALUES (1, 'Bar POS', 'Antananarivo, Madagascar', '034 00 000 00', 'contact@barpos.mg', '🍺', 'emoji', TRUE);

-- Personnel (mots de passe hachés avec bcrypt)
-- admin123 / gerant123 / 1234 restent les identifiants initiaux documentés.
INSERT INTO personnel (nom, prenom, login, mot_de_passe, role, actif) VALUES
('Admin', 'Super', 'admin', '$2y$12$WB89a9yqisbvUyuNMomReecOaS/HKvqecQkhWFYPaU5YVZYaUhea6', 'Administrateur', TRUE),
('Gérant', 'Principal', 'gerant', '$2y$12$qPGWQU3EmFWlxv2LAt5OlOueUqUNedQ/RQ7NtLOcm2ek0AnUiVOP.', 'Gérant', TRUE),
('Caisse', 'Jean', 'caisse1', '$2y$12$HJ4YDYJC78jV2aVJZmIIL.wk.FDjCiwIfFrUs5qHUCvUebYeGs2fm', 'Caissier', TRUE),
('Caisse', 'Marie', 'caisse2', '$2y$12$HJ4YDYJC78jV2aVJZmIIL.wk.FDjCiwIfFrUs5qHUCvUebYeGs2fm', 'Caissier', TRUE),
('Magasin', 'Paul', 'magasin', '$2y$12$HJ4YDYJC78jV2aVJZmIIL.wk.FDjCiwIfFrUs5qHUCvUebYeGs2fm', 'Magasinier', TRUE),
('Serveur', 'Luc', 'serveur', '$2y$12$HJ4YDYJC78jV2aVJZmIIL.wk.FDjCiwIfFrUs5qHUCvUebYeGs2fm', 'Serveur', TRUE);

-- Familles
INSERT INTO familles (code, famille, couleur, ordre) VALUES
('BIE', 'Bières', '#F59E0B', 1),
('SPI', 'Spiritueux', '#8B5CF6', 2),
('SOF', 'Softs', '#10B981', 3),
('SNA', 'Snacks', '#EC4899', 4);

-- Articles
INSERT INTO articles (code, nom, idfamille, emoji, prix_achat, prix_vente, stock, stock_min, gere_stock, saisie_prix_vente) VALUES
('BIE001', 'THB Pilsener', 1, '🍺', 3000, 4000, 50, 10, TRUE, FALSE),
('BIE002', 'Gold', 1, '🍺', 3500, 5000, 40, 10, TRUE, FALSE),
('SPI001', 'Rhum Dzama', 2, '🥃', 8000, 12000, 20, 5, TRUE, FALSE),
('SPI002', 'Whisky', 2, '🥃', 18000, 25000, 15, 3, TRUE, FALSE),
('SOF001', 'Coca-Cola', 3, '🥤', 2000, 3000, 60, 15, TRUE, FALSE),
('SOF002', 'Eau Vive', 3, '💧', 800, 1500, 100, 20, TRUE, FALSE),
('SNA001', 'Cacahuètes', 4, '🥜', 1000, 2000, 30, 10, TRUE, FALSE),
('SNA002', 'Chips', 4, '🍟', 2000, 3000, 25, 8, TRUE, FALSE),
('SNA003', 'Brochettes', 4, '🍢', 3000, 5000, 0, 0, FALSE, TRUE),
('SNA004', 'Poulet grillé', 4, '🍗', 7000, 10000, 0, 0, FALSE, TRUE);

-- Tables restaurant
INSERT INTO tables_resto (numero, description, places, etat) VALUES
(1, 'Terrasse 1', 4, 'Libre'),
(2, 'Terrasse 2', 4, 'Libre'),
(3, 'Intérieur 1', 6, 'Libre'),
(4, 'Intérieur 2', 6, 'Libre'),
(5, 'VIP', 8, 'Libre');

-- Fournisseurs
INSERT INTO fournisseurs (nom, adresse, telephone) VALUES
('STAR Beverages', 'Ankorondrano', '020 22 000 00'),
('Dzama Company', 'Nosy Be', '020 86 000 00');

-- Client exemple
INSERT INTO clients (nom_client, telephone, credit_total) VALUES
('Bertrand', '038 34 092 61', 0);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue des articles avec famille
CREATE OR REPLACE VIEW v_articles AS
SELECT 
    a.*,
    f.famille,
    f.couleur AS famille_couleur
FROM articles a
LEFT JOIN familles f ON a.idfamille = f.idfamille
WHERE a.actif = TRUE;

-- Vue des ventes du jour
CREATE OR REPLACE VIEW v_ventes_jour AS
SELECT 
    v.*,
    p.prenom AS caissier_prenom,
    p.nom AS caissier_nom,
    t.description AS table_description
FROM ventes v
LEFT JOIN personnel p ON v.idpersonnel = p.idpersonnel
LEFT JOIN tables_resto t ON v.idtable = t.idtable
WHERE v.date_vente = CURDATE();

-- Vue du stock en alerte
CREATE OR REPLACE VIEW v_stock_alerte AS
SELECT 
    a.*,
    f.famille
FROM articles a
LEFT JOIN familles f ON a.idfamille = f.idfamille
WHERE a.actif = TRUE 
  AND a.gere_stock = TRUE 
  AND a.stock <= a.stock_min;

-- ============================================
-- PROCÉDURES STOCKÉES
-- ============================================

DELIMITER //

-- Procédure de clôture de caisse
CREATE PROCEDURE sp_cloture_caisse(
    IN p_idpersonnel INT,
    OUT p_idcloture INT
)
BEGIN
    DECLARE v_total_ventes DECIMAL(12,2) DEFAULT 0;
    DECLARE v_total_remises DECIMAL(12,2) DEFAULT 0;
    DECLARE v_total_especes DECIMAL(12,2) DEFAULT 0;
    DECLARE v_total_mobile DECIMAL(12,2) DEFAULT 0;
    DECLARE v_total_credit DECIMAL(12,2) DEFAULT 0;
    DECLARE v_total_remboursements DECIMAL(12,2) DEFAULT 0;
    DECLARE v_nb_ventes INT DEFAULT 0;
    
    -- Calculer les totaux
    SELECT 
        COALESCE(SUM(total - remise), 0),
        COALESCE(SUM(remise), 0),
        COUNT(*)
    INTO v_total_ventes, v_total_remises, v_nb_ventes
    FROM ventes 
    WHERE idpersonnel = p_idpersonnel 
      AND statut = 'Payée' 
      AND cloturee = FALSE;
    
    -- Paiements espèces
    SELECT COALESCE(SUM(p.montant), 0) INTO v_total_especes
    FROM paiements p
    INNER JOIN ventes v ON p.idvente = v.idvente
    WHERE v.idpersonnel = p_idpersonnel 
      AND v.cloturee = FALSE
      AND p.mode_paiement = 'Espèces';
    
    -- Paiements mobile
    SELECT COALESCE(SUM(p.montant), 0) INTO v_total_mobile
    FROM paiements p
    INNER JOIN ventes v ON p.idvente = v.idvente
    WHERE v.idpersonnel = p_idpersonnel 
      AND v.cloturee = FALSE
      AND p.mode_paiement = 'Mobile Money';
    
    -- Paiements crédit
    SELECT COALESCE(SUM(p.montant), 0) INTO v_total_credit
    FROM paiements p
    INNER JOIN ventes v ON p.idvente = v.idvente
    WHERE v.idpersonnel = p_idpersonnel 
      AND v.cloturee = FALSE
      AND p.mode_paiement = 'Crédit';
    
    -- Remboursements reçus (paiements avec idvente = NULL)
    SELECT COALESCE(SUM(montant), 0) INTO v_total_remboursements
    FROM paiements
    WHERE idpersonnel = p_idpersonnel
      AND date_paiement = CURDATE()
      AND idvente IS NULL;
    
    -- Créer la clôture
    INSERT INTO clotures (
        date_cloture, heure, idpersonnel,
        total_ventes, total_remises, total_especes, 
        total_mobile, total_credit, total_remboursements, nb_ventes
    ) VALUES (
        CURDATE(), CURTIME(), p_idpersonnel,
        v_total_ventes, v_total_remises, v_total_especes,
        v_total_mobile, v_total_credit, v_total_remboursements, v_nb_ventes
    );
    
    SET p_idcloture = LAST_INSERT_ID();
    
    -- Marquer les ventes comme clôturées
    UPDATE ventes 
    SET cloturee = TRUE, idcloture = p_idcloture
    WHERE idpersonnel = p_idpersonnel 
      AND statut = 'Payée' 
      AND cloturee = FALSE;
    
    -- Marquer les achats comme clôturés
    UPDATE achats 
    SET cloturee = TRUE, idcloture = p_idcloture
    WHERE idpersonnel = p_idpersonnel 
      AND date_achat = CURDATE()
      AND cloturee = FALSE;
END //

DELIMITER ;

-- ============================================
-- FIN DU SCRIPT
-- ============================================
