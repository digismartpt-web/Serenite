-- ============================================================
-- Sérénité – Schéma PostgreSQL complet
-- Cible : PostgreSQL 15+ sur VPS via Coolify
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "citext";      -- emails insensibles à la casse

-- ============================================================
-- Fonction trigger : mise à jour automatique de updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- UTILISATEURS
-- ============================================================

CREATE TABLE users (
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
  -- Champs techniques (auth / app)
  password_hash           VARCHAR(255),                        -- connexion email/password alternative
  push_token              VARCHAR(512),                        -- token Expo pour notifications push
  onboarding_completed    BOOLEAN     DEFAULT FALSE,
  -- Préférences
  language                VARCHAR(5)  DEFAULT 'fr',
  theme_id                VARCHAR(50) DEFAULT 'ciel',
  calendar_color          VARCHAR(7)  DEFAULT '#EAF3DE',
  calendar_color_text     VARCHAR(7)  DEFAULT '#27500A',
  -- Sécurité
  email_verified          BOOLEAN     DEFAULT FALSE,
  -- Horodatages
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at sur users
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();

-- Index users
CREATE INDEX idx_users_email       ON users(email);
CREATE INDEX idx_users_role        ON users(role);
CREATE INDEX idx_users_phone       ON users(phone);

-- ============================================================
-- FAMILLES
-- ============================================================

CREATE TABLE families (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_a_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  parent_b_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  -- Invitation rapide intégrée à la famille
  invite_token      VARCHAR(64) UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  status            VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','active','solo')),
  name              VARCHAR(200),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index families
CREATE INDEX idx_families_parent_a ON families(parent_a_id);
CREATE INDEX idx_families_parent_b ON families(parent_b_id);
CREATE INDEX idx_families_token    ON families(invite_token);

-- ============================================================
-- INVITATIONS COPARENT (suivi détaillé, multi-méthodes)
-- Complète families.invite_token pour les cas avancés :
-- partage par SMS / email / QR / renouvellement de code
-- ============================================================

CREATE TABLE invitations (
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

CREATE INDEX idx_invitations_code   ON invitations(code);
CREATE INDEX idx_invitations_token  ON invitations(token);
CREATE INDEX idx_invitations_family ON invitations(family_id);
CREATE INDEX idx_invitations_status ON invitations(status) WHERE status = 'pending';

-- ============================================================
-- ENFANTS
-- ============================================================

CREATE TABLE children (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID        REFERENCES families(id) ON DELETE CASCADE,
  first_name          VARCHAR(100) NOT NULL,
  birth_date          DATE        NOT NULL,
  age                 INTEGER     GENERATED ALWAYS AS
                        (EXTRACT(YEAR FROM AGE(birth_date))::INTEGER) STORED,
  user_id             UUID        REFERENCES users(id),        -- compte autonome ≥ 12 ans
  calendar_color      VARCHAR(7)  DEFAULT '#EEEDFE',
  calendar_color_text VARCHAR(7)  DEFAULT '#3C3489',
  -- Accès autonome (≥ 12 ans)
  family_access_code  VARCHAR(8),                              -- code 8 chiffres saisi par l'enfant
  pin_hash            VARCHAR(255),                            -- PIN enfant (si compte propre)
  created_by          UUID        REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_children_family    ON children(family_id);
CREATE INDEX idx_children_user      ON children(user_id);

-- ============================================================
-- CONSENTEMENTS RGPD
-- ============================================================

CREATE TABLE consents (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID    REFERENCES users(id) ON DELETE CASCADE,
  cgu_accepted              BOOLEAN DEFAULT FALSE,
  data_processing_accepted  BOOLEAN DEFAULT FALSE,
  children_data_accepted    BOOLEAN DEFAULT FALSE,
  newsletter_accepted       BOOLEAN DEFAULT FALSE,
  ip_address                INET,
  accepted_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consents_user ON consents(user_id);

-- ============================================================
-- Vue pratique : famille complète (pour GET /api/families/me)
-- ============================================================

CREATE VIEW v_family_full AS
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

-- ============================================================
-- MESSAGES CNV
-- ============================================================

CREATE TABLE messages (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id            UUID          REFERENCES families(id) ON DELETE CASCADE,
  sender_id            UUID          REFERENCES users(id),
  content              TEXT          NOT NULL,
  original_content     TEXT,                           -- brouillon avant reformulation
  is_reformulated      BOOLEAN       DEFAULT FALSE,
  aggressiveness_score DECIMAL(3,2)  CHECK (aggressiveness_score BETWEEN 0 AND 1),
  content_hash         VARCHAR(64),                    -- SHA-256 horodaté (preuve)
  read_at              TIMESTAMPTZ,
  pause_expires_at     TIMESTAMPTZ,                    -- pause 10 min si score > 0.7
  created_at           TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_messages_family     ON messages(family_id);
CREATE INDEX idx_messages_sender     ON messages(sender_id);
CREATE INDEX idx_messages_created    ON messages(family_id, created_at DESC);
CREATE INDEX idx_messages_unread     ON messages(family_id, read_at) WHERE read_at IS NULL;

-- ============================================================
-- ÉVÉNEMENTS AGENDA
-- ============================================================

CREATE TABLE events (
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

CREATE TABLE event_children (
  event_id  UUID REFERENCES events(id)   ON DELETE CASCADE,
  child_id  UUID REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, child_id)
);

CREATE INDEX idx_events_family     ON events(family_id);
CREATE INDEX idx_events_start      ON events(family_id, start_at);
CREATE INDEX idx_events_created_by ON events(created_by);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- DEMANDES D'ÉCHANGE DE GARDE
-- ============================================================

CREATE TABLE exchange_requests (
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

CREATE INDEX idx_exchange_family ON exchange_requests(family_id);
CREATE INDEX idx_exchange_status ON exchange_requests(status) WHERE status = 'pending';

-- ============================================================
-- DÉPENSES / FINANCES
-- ============================================================

CREATE TABLE expenses (
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
  validated_by UUID          REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_expenses_family ON expenses(family_id);
CREATE INDEX idx_expenses_date   ON expenses(family_id, expense_date DESC);
CREATE INDEX idx_expenses_paid   ON expenses(paid_by);

-- ============================================================
-- Nettoyage des invitations expirées
-- À planifier via pg_cron (ex: toutes les heures)
-- SELECT cron.schedule('expire-invitations','0 * * * *',
--   $$UPDATE invitations SET status='expired'
--     WHERE status='pending' AND expires_at < NOW()$$);
-- ============================================================
