-- ============================================================
-- LUMINA — Schéma Supabase complet
-- Exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE : purchases
-- Enregistre chaque achat Gumroad validé
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  gumroad_sale_id   TEXT UNIQUE NOT NULL,
  email             TEXT NOT NULL,
  product_id        TEXT NOT NULL,
  purchase_date     TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'refunded', 'disabled', 'disputed')),
  access_key_hash   TEXT NOT NULL,        -- bcrypt hash de la clé d'accès
  access_key_prefix TEXT NOT NULL,        -- 8 premiers caractères pour l'affichage admin
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  used_at           TIMESTAMPTZ,          -- premier login avec cette clé
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_purchases_email ON public.purchases(email);
CREATE INDEX idx_purchases_gumroad_sale_id ON public.purchases(gumroad_sale_id);

-- ============================================================
-- TABLE : profiles
-- Profil utilisateur (lié à auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  first_name  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  is_admin    BOOLEAN DEFAULT FALSE
);

-- Trigger : créer un profil automatiquement quand un user s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLE : questionnaire_responses
-- Sauvegarde progressive des réponses au questionnaire
-- ============================================================
CREATE TABLE IF NOT EXISTS public.questionnaire_responses (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  section         TEXT NOT NULL,          -- ex: 'identity', 'organisation', 'birth_data'
  data            JSONB NOT NULL DEFAULT '{}',
  is_complete     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, section)
);

CREATE INDEX idx_questionnaire_user_id ON public.questionnaire_responses(user_id);

-- ============================================================
-- TABLE : sacred_profiles
-- Données calculées : astrologie, Human Design, numérologie
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sacred_profiles (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  -- Données brutes
  birth_date      DATE NOT NULL,
  birth_time      TIME,
  birth_city      TEXT NOT NULL,
  birth_country   TEXT NOT NULL,
  birth_lat       DECIMAL(9,6),
  birth_lng       DECIMAL(9,6),
  full_name       TEXT NOT NULL,
  -- Numérologie (calculé deterministement)
  numerology      JSONB DEFAULT '{}',
  -- Astrologie (calculé via Swiss Ephemeris ou API)
  astrology       JSONB DEFAULT '{}',
  -- Human Design (calculé)
  human_design    JSONB DEFAULT '{}',
  -- Statut des calculs
  astro_calculated_at   TIMESTAMPTZ,
  hd_calculated_at      TIMESTAMPTZ,
  num_calculated_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE : analyses
-- Résultat de l'analyse IA LUMINA ENGINE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analyses (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'generating', 'complete', 'error')),
  -- Résultat JSON structuré
  result          JSONB,
  -- Métadonnées de génération
  ai_model        TEXT,
  prompt_tokens   INTEGER,
  completion_tokens INTEGER,
  generation_time_ms INTEGER,
  error_message   TEXT,
  -- PDF
  pdf_url         TEXT,
  pdf_generated_at TIMESTAMPTZ,
  -- Email
  email_sent      BOOLEAN DEFAULT FALSE,
  email_sent_at   TIMESTAMPTZ,
  email_error     TEXT,
  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX idx_analyses_status ON public.analyses(status);

-- ============================================================
-- TABLE : pdf_files
-- Fichiers PDF générés (stockés dans Supabase Storage)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pdf_files (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  analysis_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  public_url  TEXT,
  file_size   INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sacred_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_files ENABLE ROW LEVEL SECURITY;

-- PURCHASES : visible uniquement par admin (via service role) ou par l'utilisateur concerné
CREATE POLICY "purchases_self" ON public.purchases
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- PROFILES : chaque utilisateur voit uniquement son profil
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- QUESTIONNAIRE : chaque utilisateur voit uniquement ses réponses
CREATE POLICY "questionnaire_self" ON public.questionnaire_responses
  FOR ALL USING (auth.uid() = user_id);

-- SACRED PROFILES : chaque utilisateur voit uniquement son profil sacré
CREATE POLICY "sacred_profiles_self" ON public.sacred_profiles
  FOR ALL USING (auth.uid() = user_id);

-- ANALYSES : chaque utilisateur voit uniquement ses analyses
CREATE POLICY "analyses_self" ON public.analyses
  FOR ALL USING (auth.uid() = user_id);

-- PDF FILES : chaque utilisateur voit uniquement ses PDFs
CREATE POLICY "pdf_files_self" ON public.pdf_files
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FONCTIONS UTILITAIRES
-- ============================================================

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_questionnaire_updated_at
  BEFORE UPDATE ON public.questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_sacred_profiles_updated_at
  BEFORE UPDATE ON public.sacred_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_analyses_updated_at
  BEFORE UPDATE ON public.analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- STORAGE : bucket pour les PDFs
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('lumina-pdfs', 'lumina-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Policy storage : chaque user accède à son propre dossier
CREATE POLICY "pdf_storage_self" ON storage.objects
  FOR ALL USING (
    bucket_id = 'lumina-pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
