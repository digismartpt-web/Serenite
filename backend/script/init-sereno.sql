CREATE SCHEMA IF NOT EXISTS sereno;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE TABLE IF NOT EXISTS sereno.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    role TEXT CHECK (role IN ('parent', 'child')) NOT NULL,
    family_id UUID REFERENCES sereno.families(family_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sereno.families (
    family_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sereno.invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES sereno.families(family_id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sereno.messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES sereno.users(user_id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES sereno.users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    original_content TEXT NOT NULL,
    is_reformulated BOOLEAN DEFAULT FALSE,
    aggressiveness_score NUMERIC(3, 2) DEFAULT 0.0,
    content_hash TEXT NOT NULL,
    pause_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION sereno.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON sereno.users FOR EACH ROW EXECUTE FUNCTION sereno.update_updated_at_column();
CREATE TRIGGER families_updated_at BEFORE UPDATE ON sereno.families FOR EACH ROW EXECUTE FUNCTION sereno.update_updated_at_column();
CREATE TRIGGER invitations_updated_at BEFORE UPDATE ON sereno.invitations FOR EACH ROW EXECUTE FUNCTION sereno.update_updated_at_column();
CREATE TRIGGER messages_updated_at BEFORE UPDATE ON sereno.messages FOR EACH ROW EXECUTE FUNCTION sereno.update_updated_at_column();
