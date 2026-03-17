-- ============================================================
-- Sérénité – Données de test
-- PIN par défaut : 1234  (haché via pgcrypto bcrypt)
-- À exécuter APRÈS schema.sql
-- ============================================================

-- ============================================================
-- UUIDs fixes pour reproductibilité
-- ============================================================

-- Utilisateurs
-- Thomas  : a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- Marie   : b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22
-- Famille : c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33
-- Emma    : d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44
-- Lucas   : e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55

-- ============================================================
-- Nettoyage (pour re-exécution idempotente)
-- ============================================================

DELETE FROM consents  WHERE user_id  IN (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
);
DELETE FROM children  WHERE family_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
DELETE FROM invitations WHERE family_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
DELETE FROM families  WHERE id         = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
DELETE FROM users     WHERE id IN (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
);

-- ============================================================
-- UTILISATEURS
-- ============================================================

INSERT INTO users (
  id,
  first_name, last_name, email, phone,
  birth_date,
  role, parent_type, status,
  children_count,
  pin_hash,
  language, theme_id,
  calendar_color, calendar_color_text,
  email_verified,
  onboarding_completed
) VALUES
  -- Thomas – Papa
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Thomas', 'Durand',
    'thomas.durand@test.serenite.app',
    '+33612345678',
    '1985-06-15',
    'parent', 'papa', 'separated',
    2,
    -- PIN 1234 haché avec bcrypt (coût 12) via pgcrypto
    crypt('1234', gen_salt('bf', 12)),
    'fr', 'ciel',
    '#EAF3DE', '#27500A',
    TRUE,
    TRUE
  ),
  -- Marie – Maman
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'Marie', 'Durand',
    'marie.durand@test.serenite.app',
    '+33698765432',
    '1987-03-22',
    'parent', 'maman', 'separated',
    2,
    crypt('1234', gen_salt('bf', 12)),
    'fr', 'aurore',
    '#EEEDFE', '#3C3489',
    TRUE,
    TRUE
  );

-- ============================================================
-- FAMILLE
-- ============================================================

INSERT INTO families (
  id,
  parent_a_id, parent_b_id,
  status, name,
  created_at
) VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',  -- Thomas
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',  -- Marie
  'active',
  'Famille Durand',
  NOW()
);

-- ============================================================
-- ENFANTS
-- ============================================================

INSERT INTO children (
  id,
  family_id,
  first_name, birth_date,
  calendar_color, calendar_color_text,
  created_by
) VALUES
  -- Emma, 8 ans
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'Emma',
    '2016-04-10',
    '#FEF3C7', '#92400E',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  ),
  -- Lucas, 11 ans
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'Lucas',
    '2013-09-03',
    '#D1FAE5', '#065F46',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  );

-- ============================================================
-- CONSENTEMENTS RGPD
-- ============================================================

INSERT INTO consents (
  user_id,
  cgu_accepted,
  data_processing_accepted,
  children_data_accepted,
  newsletter_accepted,
  ip_address
) VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    TRUE, TRUE, TRUE, FALSE,
    '127.0.0.1'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    TRUE, TRUE, TRUE, TRUE,
    '127.0.0.1'
  );

-- ============================================================
-- INVITATION de test (déjà acceptée)
-- ============================================================

INSERT INTO invitations (
  family_id,
  inviter_id,
  code, token,
  method, status,
  expires_at,
  accepted_by, accepted_at
) VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '123456',
  'seed-token-accepted-do-not-use-in-prod-abc123',
  'code', 'accepted',
  NOW() + INTERVAL '7 days',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  NOW()
);

-- ============================================================
-- Vérification finale
-- ============================================================

DO $$
DECLARE
  u_count INTEGER;
  f_count INTEGER;
  c_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO u_count FROM users
    WHERE id IN (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
    );
  SELECT COUNT(*) INTO f_count FROM families
    WHERE id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
  SELECT COUNT(*) INTO c_count FROM children
    WHERE family_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  RAISE NOTICE '✓ Seed chargé — utilisateurs: %, familles: %, enfants: %',
    u_count, f_count, c_count;
END;
$$;
