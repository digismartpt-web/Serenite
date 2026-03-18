-- ============================================================
-- Sérénité – Initialisation complète de la base
-- Combine schema.sql + seed.sql en une seule commande
--
-- Usage :
--   psql -h HOST -U USER -d serenite -f database/init.sql
--
-- Prérequis : base 'serenite' déjà créée
--   CREATE DATABASE serenite;
-- ============================================================

\echo '=== Sérénité — init.sql démarré ==='
\echo ''

-- ──────────────────────────────────────────────────────────────
-- PARTIE 1 : SCHÉMA
-- ──────────────────────────────────────────────────────────────

\echo '→ Chargement du schéma…'

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ── Fonction trigger : mise à jour automatique de updated_at ──

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── UTILISATEURS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name              VARCHAR(100) NOT NULL,
  last_name               VARCHAR(100) NOT NULL,
  email                   CITEXT      UNIQUE NOT NULL,
  phone                   VARCHAR(20),
  address                 TEXT,
  birth_date              DATE,
  age                     INTEGER     GENERATED ALWAYS AS
                            (EXTRACT(YEAR FROM AGE(birth_date))::INTEGER) STORED,
  role                    VARCHAR(20) NOT NULL
                            CHECK (role IN ('parent','child','solo')),
  parent_type             VARCHAR(20)
                            CHECK (parent_type IN ('papa','maman','beau-pere','belle-mere')),
  status                  VARCHAR(20)
                            CHECK (status IN ('separated','divorced')),
  children_count          INTEGER     DEFAULT 0,
  pin_hash                VARCHAR(255) NOT NULL,
  password_hash           VARCHAR(255),
  push_token              VARCHAR(512),
  onboarding_completed    BOOLEAN     DEFAULT FALSE,
  language                VARCHAR(5)  DEFAULT 'fr',
  theme_id                VARCHAR(50) DEFAULT 'ciel',
  calendar_color          VARCHAR(7)  DEFAULT '#EAF3DE',
  calendar_color_text     VARCHAR(7)  DEFAULT '#27500A',
  email_verified          BOOLEAN     DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- ── FAMILLES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS families (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_a_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  parent_b_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  invite_token      VARCHAR(64) UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  status            VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','active','solo')),
  name              VARCHAR(200),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_families_parent_a ON families(parent_a_id);
CREATE INDEX IF NOT EXISTS idx_families_parent_b ON families(parent_b_id);
CREATE INDEX IF NOT EXISTS idx_families_token    ON families(invite_token);

-- ── INVITATIONS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID        REFERENCES families(id) ON DELETE CASCADE,
  inviter_id  UUID        REFERENCES users(id),
  code        VARCHAR(6)  UNIQUE NOT NULL,
  token       VARCHAR(64) UNIQUE NOT NULL,
  method      VARCHAR(10) CHECK (method IN ('sms','email','code','qr')),
  status      VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','expired','cancelled')),
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_by UUID        REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_code   ON invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_token  ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_family ON invitations(family_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status) WHERE status = 'pending';

-- ── ENFANTS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS children (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID        REFERENCES families(id) ON DELETE CASCADE,
  first_name          VARCHAR(100) NOT NULL,
  birth_date          DATE        NOT NULL,
  age                 INTEGER     GENERATED ALWAYS AS
                        (EXTRACT(YEAR FROM AGE(birth_date))::INTEGER) STORED,
  user_id             UUID        REFERENCES users(id),
  calendar_color      VARCHAR(7)  DEFAULT '#EEEDFE',
  calendar_color_text VARCHAR(7)  DEFAULT '#3C3489',
  family_access_code  VARCHAR(8),
  pin_hash            VARCHAR(255),
  created_by          UUID        REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
CREATE INDEX IF NOT EXISTS idx_children_user   ON children(user_id);

-- ── CONSENTEMENTS RGPD ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consents (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID    REFERENCES users(id) ON DELETE CASCADE,
  cgu_accepted              BOOLEAN DEFAULT FALSE,
  data_processing_accepted  BOOLEAN DEFAULT FALSE,
  children_data_accepted    BOOLEAN DEFAULT FALSE,
  newsletter_accepted       BOOLEAN DEFAULT FALSE,
  ip_address                INET,
  accepted_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consents_user ON consents(user_id);

-- ── VUE FAMILLE COMPLÈTE ──────────────────────────────────────

CREATE OR REPLACE VIEW v_family_full AS
SELECT
  f.id                  AS family_id,
  f.name                AS family_name,
  f.status              AS family_status,
  pa.id                 AS parent_a_id,
  pa.first_name         AS parent_a_first_name,
  pa.last_name          AS parent_a_last_name,
  pa.email              AS parent_a_email,
  pa.parent_type        AS parent_a_type,
  pa.calendar_color     AS parent_a_color,
  pb.id                 AS parent_b_id,
  pb.first_name         AS parent_b_first_name,
  pb.last_name          AS parent_b_last_name,
  pb.email              AS parent_b_email,
  pb.parent_type        AS parent_b_type,
  pb.calendar_color     AS parent_b_color,
  f.created_at
FROM families f
LEFT JOIN users pa ON pa.id = f.parent_a_id
LEFT JOIN users pb ON pb.id = f.parent_b_id;

-- ── MESSAGES CNV ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id            UUID          REFERENCES families(id) ON DELETE CASCADE,
  sender_id            UUID          REFERENCES users(id),
  content              TEXT          NOT NULL,
  original_content     TEXT,
  is_reformulated      BOOLEAN       DEFAULT FALSE,
  aggressiveness_score DECIMAL(3,2)  CHECK (aggressiveness_score BETWEEN 0 AND 1),
  content_hash         VARCHAR(64),
  read_at              TIMESTAMPTZ,
  pause_expires_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_family  ON messages(family_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender  ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread  ON messages(family_id, read_at) WHERE read_at IS NULL;

-- ── ÉVÉNEMENTS AGENDA ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID         REFERENCES families(id) ON DELETE CASCADE,
  created_by  UUID         REFERENCES users(id),
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  start_at    TIMESTAMPTZ  NOT NULL,
  end_at      TIMESTAMPTZ  NOT NULL,
  all_day     BOOLEAN      DEFAULT FALSE,
  category    VARCHAR(20)  DEFAULT 'autre'
                CHECK (category IN ('visite','vacances','scolaire','medical','activite','autre')),
  color       VARCHAR(7),
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_children (
  event_id  UUID REFERENCES events(id)   ON DELETE CASCADE,
  child_id  UUID REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_events_family     ON events(family_id);
CREATE INDEX IF NOT EXISTS idx_events_start      ON events(family_id, start_at);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_events_updated_at') THEN
    CREATE TRIGGER trg_events_updated_at
      BEFORE UPDATE ON events
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

-- ── DEMANDES D'ÉCHANGE DE GARDE ───────────────────────────────

CREATE TABLE IF NOT EXISTS exchange_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID        REFERENCES families(id) ON DELETE CASCADE,
  requested_by  UUID        REFERENCES users(id),
  event_id      UUID        REFERENCES events(id)   ON DELETE CASCADE,
  reason        TEXT,
  proposed_date DATE,
  status        VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','refused','cancelled')),
  responded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_family ON exchange_requests(family_id);
CREATE INDEX IF NOT EXISTS idx_exchange_status ON exchange_requests(status) WHERE status = 'pending';

-- ── DÉPENSES / FINANCES ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID          REFERENCES families(id) ON DELETE CASCADE,
  paid_by      UUID          REFERENCES users(id),
  title        VARCHAR(200)  NOT NULL,
  amount       DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category     VARCHAR(30)   DEFAULT 'autre'
                 CHECK (category IN
                   ('garde','activite','sante','scolarite','vetement','alimentation','loisir','autre')),
  expense_date DATE          NOT NULL DEFAULT CURRENT_DATE,
  split_ratio  DECIMAL(4,2)  DEFAULT 0.50 CHECK (split_ratio BETWEEN 0 AND 1),
  validated_by UUID          REFERENCES users(id),   -- null = en attente
  validated_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_family ON expenses(family_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date   ON expenses(family_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_paid   ON expenses(paid_by);

\echo '→ Schéma chargé avec succès.'
\echo ''

-- ──────────────────────────────────────────────────────────────
-- PARTIE 2 : DONNÉES DE TEST (seed)
-- ──────────────────────────────────────────────────────────────

\echo '→ Chargement des données de test…'

-- Nettoyage idempotent
DELETE FROM consents    WHERE user_id IN (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
DELETE FROM children    WHERE family_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
DELETE FROM invitations WHERE family_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
DELETE FROM families    WHERE id        = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
DELETE FROM users       WHERE id IN (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');

-- Utilisateurs
INSERT INTO users (
  id, first_name, last_name, email, phone, birth_date,
  role, parent_type, status, children_count, pin_hash,
  language, theme_id, calendar_color, calendar_color_text,
  email_verified, onboarding_completed
) VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Thomas', 'Durand', 'thomas.durand@test.serenite.app', '+33612345678',
    '1985-06-15', 'parent', 'papa', 'separated', 2,
    crypt('1234', gen_salt('bf', 12)),
    'fr', 'ciel', '#EAF3DE', '#27500A', TRUE, TRUE
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'Marie', 'Durand', 'marie.durand@test.serenite.app', '+33698765432',
    '1987-03-22', 'parent', 'maman', 'separated', 2,
    crypt('1234', gen_salt('bf', 12)),
    'fr', 'lavande', '#EEEDFE', '#3C3489', TRUE, TRUE
  );

-- Famille
INSERT INTO families (id, parent_a_id, parent_b_id, status, name) VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'active', 'Famille Durand'
);

-- Enfants
INSERT INTO children (id, family_id, first_name, birth_date, calendar_color, calendar_color_text, created_by) VALUES
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Emma', '2016-04-10',
   '#FEF3C7', '#92400E', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
   'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Lucas', '2013-09-03',
   '#D1FAE5', '#065F46', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- Consentements
INSERT INTO consents (user_id, cgu_accepted, data_processing_accepted, children_data_accepted, newsletter_accepted, ip_address) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', TRUE, TRUE, TRUE, FALSE, '127.0.0.1'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', TRUE, TRUE, TRUE, TRUE,  '127.0.0.1');

-- Invitation de test (déjà acceptée)
INSERT INTO invitations (family_id, inviter_id, code, token, method, status, expires_at, accepted_by, accepted_at) VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '123456', 'seed-token-accepted-do-not-use-in-prod-abc123',
  'code', 'accepted',
  NOW() + INTERVAL '7 days',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', NOW()
);

-- Vérification finale
DO $$
DECLARE
  u_count INTEGER; f_count INTEGER; c_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO u_count FROM users
    WHERE id IN ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
  SELECT COUNT(*) INTO f_count FROM families
    WHERE id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
  SELECT COUNT(*) INTO c_count FROM children
    WHERE family_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
  RAISE NOTICE '✓ Seed — utilisateurs: %, familles: %, enfants: %', u_count, f_count, c_count;
END;
$$;

\echo ''
\echo '=== init.sql terminé — base prête ==='
