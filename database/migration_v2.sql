-- ============================================================
-- Sérénité – Migration v2 : Coffre-fort + Carnet santé + Uploads
-- ============================================================

-- ── 1. Uploads / photos justificatives ─────────────────────────
-- (le champ receipt_url existe déjà dans la table expenses)

-- ── 2. Coffre-fort documentaire ────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  uploaded_by   UUID REFERENCES users(id) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  category      VARCHAR(30) NOT NULL DEFAULT 'autre'
                  CHECK (category IN ('jugement','ordonnance','convention','scolaire','medical','administratif','identite','autre')),
  file_path     VARCHAR(500) NOT NULL,
  file_type     VARCHAR(50),
  file_size     INTEGER DEFAULT 0,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_family ON vault_documents(family_id);
CREATE INDEX IF NOT EXISTS idx_vault_category ON vault_documents(category);

-- ── 3. Carnet de santé numérique partagé ───────────────────────

CREATE TABLE IF NOT EXISTS health_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  child_id      UUID REFERENCES children(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES users(id) NOT NULL,
  record_type   VARCHAR(30) NOT NULL
                  CHECK (record_type IN ('vaccin','traitement','ordonnance','consultation','allergie','poids','taille','autre')),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  record_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  file_path     VARCHAR(500),
  doctor_name   VARCHAR(200),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_family ON health_records(family_id);
CREATE INDEX IF NOT EXISTS idx_health_child  ON health_records(child_id);
CREATE INDEX IF NOT EXISTS idx_health_type   ON health_records(record_type);
