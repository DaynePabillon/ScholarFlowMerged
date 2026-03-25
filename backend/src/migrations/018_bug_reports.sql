-- Migration: 018_bug_reports.sql
-- Bug/Problem reporting feature for SkyFlow

CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    category VARCHAR(50) NOT NULL DEFAULT 'bug' CHECK (category IN ('bug', 'feature', 'feedback', 'other')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    page_url TEXT,
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved', 'dismissed')),
    creator_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON bug_reports(created_at DESC);
