-- AI Insights Cache: stores the last Gemini response per organization
-- Only regenerates when data_hash changes (i.e. underlying data changed)
CREATE TABLE IF NOT EXISTS ai_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  insights_json JSONB NOT NULL,
  data_hash VARCHAR(64) NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id)
);
