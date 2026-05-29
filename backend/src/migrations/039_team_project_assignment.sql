-- Migration: 039_team_project_assignment.sql
-- Adds project_id FK to team_groups so each team can be assigned to a project.
-- Tasks already have both project_id and team_id, so this closes the loop.

ALTER TABLE team_groups
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_groups_project ON team_groups(project_id);
