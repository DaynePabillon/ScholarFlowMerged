-- Migration 031: Add External Leader validation workflow to ss_consultation
-- Adds validation_status, validator info, and validation notes columns.

ALTER TABLE ss_consultation
  ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'not_requested'
    CHECK (validation_status IN ('not_requested', 'pending', 'validated', 'rejected')),
  ADD COLUMN IF NOT EXISTS validation_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS validated_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- Index for querying by validation status
CREATE INDEX IF NOT EXISTS idx_ss_consultation_validation_status
  ON ss_consultation (validation_status);
