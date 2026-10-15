-- ==============================================================================
-- MIGRATION: 20261012000003_seller_onboarding_context.sql
-- PROJECT: FiguredIt (Stage: MVP 1)
-- DESCRIPTION: Extends seller_profiles with structured onboarding_data JSONB
-- ==============================================================================

ALTER TABLE public.seller_profiles
ADD COLUMN IF NOT EXISTS onboarding_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Index for searching within onboarding metadata if needed
CREATE INDEX IF NOT EXISTS idx_seller_profiles_onboarding_data 
ON public.seller_profiles USING gin (onboarding_data);
