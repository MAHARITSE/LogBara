-- ============================================================================
-- BAR POS - MISE À JOUR DE LA BASE (v4.2 -> v4.3)
-- Rattachement des opérations à une clôture (anti-vol)
--
-- ✅ CONSERVE TOUTES VOS DONNÉES : aucune table supprimée, aucune ligne effacée.
-- ✅ Peut être exécuté plusieurs fois sans risque (le script vérifie avant d'agir).
--
-- COMMENT L'EXÉCUTER (WAMP / phpMyAdmin) :
--   1. Faites d'abord une sauvegarde : phpMyAdmin > logbara > Exporter
--      (ou menu Sauvegarde de Bar POS).
--   2. phpMyAdmin > cliquez sur la base « logbara » > onglet « Importer »
--      > choisissez ce fichier > Exécuter.
--      (ou onglet « SQL » : collez tout le contenu puis Exécuter)
--   Si votre base ne s'appelle pas logbara, modifiez la ligne USE ci-dessous.
-- ============================================================================

SET NAMES utf8mb4;
USE logbara;

-- ----------------------------------------------------------------------------
-- 1. Nouvelle colonne paiements.idcloture
--    (clôture à laquelle un remboursement de crédit est rattaché)
-- ----------------------------------------------------------------------------
SET @existe := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paiements' AND COLUMN_NAME = 'idcloture'
);
SET @sql := IF(@existe = 0,
    'ALTER TABLE paiements ADD COLUMN idcloture INT DEFAULT NULL',
    'SELECT ''Colonne paiements.idcloture deja presente'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index sur cette colonne
SET @existe := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paiements' AND INDEX_NAME = 'idx_paiement_cloture'
);
SET @sql := IF(@existe = 0,
    'ALTER TABLE paiements ADD INDEX idx_paiement_cloture (idcloture)',
    'SELECT ''Index idx_paiement_cloture deja present'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 2. Reprise de l'historique (sans rien modifier aux montants)
--    Les remboursements déjà comptés dans une ancienne clôture y sont rattachés :
--    même caissier, même jour, enregistrés AVANT l'heure de la clôture.
--    => ils ne seront pas comptés une deuxième fois.
--    Les remboursements saisis APRÈS la dernière clôture restent libres et
--    iront dans la prochaine clôture.
-- ----------------------------------------------------------------------------
UPDATE paiements p
SET p.idcloture = (
    SELECT c.idcloture
    FROM clotures c
    WHERE c.idpersonnel = p.idpersonnel
      AND c.date_cloture = p.date_paiement
      AND c.heure >= p.heure
    ORDER BY c.heure ASC, c.idcloture ASC
    LIMIT 1
)
WHERE p.idvente IS NULL
  AND p.idcloture IS NULL;

-- Ventes marquées clôturées mais sans numéro de clôture (anciennes données) :
-- rattachement à la clôture du même caissier, même jour.
UPDATE ventes v
SET v.idcloture = (
    SELECT c.idcloture
    FROM clotures c
    WHERE c.idpersonnel = v.idpersonnel
      AND c.date_cloture = v.date_vente
    ORDER BY c.idcloture ASC
    LIMIT 1
)
WHERE v.cloturee = TRUE
  AND v.idcloture IS NULL;

-- Idem pour les achats clôturés sans numéro de clôture : première clôture du même jour.
UPDATE achats a
SET a.idcloture = (
    SELECT c.idcloture
    FROM clotures c
    WHERE c.date_cloture = a.date_achat
    ORDER BY c.idcloture ASC
    LIMIT 1
)
WHERE a.cloturee = TRUE
  AND a.idcloture IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Procédure stockée de clôture (mise à jour de la logique)
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_cloture_caisse;

DELIMITER //

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

    SELECT COALESCE(SUM(total - remise), 0), COALESCE(SUM(remise), 0), COUNT(*)
    INTO v_total_ventes, v_total_remises, v_nb_ventes
    FROM ventes
    WHERE idpersonnel = p_idpersonnel AND statut = 'Payée' AND cloturee = FALSE;

    SELECT COALESCE(SUM(p.montant), 0) INTO v_total_especes
    FROM paiements p INNER JOIN ventes v ON p.idvente = v.idvente
    WHERE v.idpersonnel = p_idpersonnel AND v.cloturee = FALSE AND p.mode_paiement = 'Espèces';

    SELECT COALESCE(SUM(p.montant), 0) INTO v_total_mobile
    FROM paiements p INNER JOIN ventes v ON p.idvente = v.idvente
    WHERE v.idpersonnel = p_idpersonnel AND v.cloturee = FALSE AND p.mode_paiement = 'Mobile Money';

    SELECT COALESCE(SUM(p.montant), 0) INTO v_total_credit
    FROM paiements p INNER JOIN ventes v ON p.idvente = v.idvente
    WHERE v.idpersonnel = p_idpersonnel AND v.cloturee = FALSE AND p.mode_paiement = 'Crédit';

    SELECT COALESCE(SUM(montant), 0) INTO v_total_remboursements
    FROM paiements
    WHERE idpersonnel = p_idpersonnel AND idcloture IS NULL AND idvente IS NULL;

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

    UPDATE ventes SET cloturee = TRUE, idcloture = p_idcloture
    WHERE idpersonnel = p_idpersonnel AND statut = 'Payée' AND cloturee = FALSE;

    UPDATE paiements SET idcloture = p_idcloture
    WHERE idpersonnel = p_idpersonnel AND idcloture IS NULL AND idvente IS NULL;

    UPDATE achats SET cloturee = TRUE, idcloture = p_idcloture
    WHERE cloturee = FALSE;
END //

DELIMITER ;

-- ----------------------------------------------------------------------------
-- 4. Contrôle : opérations en attente de la prochaine clôture, par caissier
--    (lecture seule, ne modifie rien)
-- ----------------------------------------------------------------------------
SELECT
    CONCAT(pe.prenom, ' ', pe.nom) AS caissier,
    COUNT(v.idvente)               AS ventes_non_cloturees,
    COALESCE(SUM(v.total - v.remise), 0) AS montant_non_cloture,
    MIN(v.date_vente)              AS depuis_le
FROM ventes v
INNER JOIN personnel pe ON pe.idpersonnel = v.idpersonnel
WHERE v.statut = 'Payée' AND v.cloturee = FALSE
GROUP BY v.idpersonnel, pe.prenom, pe.nom;

-- ----------------------------------------------------------------------------
-- 5. Nouvelle colonne articles.ne_plus_vendre (masquage en caisse POS)
-- ----------------------------------------------------------------------------
SET @existe := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND COLUMN_NAME = 'ne_plus_vendre'
);
SET @sql := IF(@existe = 0,
    'ALTER TABLE articles ADD COLUMN ne_plus_vendre BOOLEAN DEFAULT FALSE',
    'SELECT ''Colonne articles.ne_plus_vendre deja presente'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 6. Nouvelle colonne articles.alerte_stock (alerte de stock bas par article)
-- ----------------------------------------------------------------------------
SET @existe := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND COLUMN_NAME = 'alerte_stock'
);
SET @sql := IF(@existe = 0,
    'ALTER TABLE articles ADD COLUMN alerte_stock BOOLEAN DEFAULT TRUE',
    'SELECT ''Colonne articles.alerte_stock deja presente'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- FIN DE LA MISE À JOUR
-- Ensuite : remplacez index.html, api/index.php et api/mappings.php dans le
-- dossier logbara de WAMP par ceux de wamp_deploy.
-- ============================================================================
