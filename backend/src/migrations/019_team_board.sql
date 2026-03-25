-- Migration: 019_team_board.sql
-- Team Board feature: team groups, members, checkpoints, and comments

-- Team Groups: Represents class teams (e.g., IT332 Team 01)
CREATE TABLE IF NOT EXISTS team_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    team_code VARCHAR(100),                          -- e.g. "2526-sem1-it332-01"
    team_number INTEGER NOT NULL,                    -- e.g. 1, 2, 3...
    name VARCHAR(255) NOT NULL,                      -- project title / team name
    description TEXT,
    adviser_id UUID REFERENCES users(id) ON DELETE SET NULL,
    adviser_name VARCHAR(255),
    leader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    leader_name VARCHAR(255),
    source_sheet_id VARCHAR(255),                    -- Google Sheet ID if imported
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Team Group Members: Individual members within a team
CREATE TABLE IF NOT EXISTS team_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_group_id UUID REFERENCES team_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- nullable if not registered in SkyFlow
    member_number INTEGER NOT NULL,                         -- 1-5 position in team
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    student_id VARCHAR(100),
    is_leader BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(team_group_id, member_number)
);

-- Team Checkpoints: Adviser-marked progress items
CREATE TABLE IF NOT EXISTS team_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_group_id UUID REFERENCES team_groups(id) ON DELETE CASCADE,
    member_id UUID REFERENCES team_group_members(id) ON DELETE SET NULL,  -- null = team-level checkpoint
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Team Comments: Discussion within a team
CREATE TABLE IF NOT EXISTS team_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_group_id UUID REFERENCES team_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_groups_org ON team_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_groups_adviser ON team_groups(adviser_id);
CREATE INDEX IF NOT EXISTS idx_team_group_members_group ON team_group_members(team_group_id);
CREATE INDEX IF NOT EXISTS idx_team_group_members_user ON team_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_checkpoints_group ON team_checkpoints(team_group_id);
CREATE INDEX IF NOT EXISTS idx_team_checkpoints_member ON team_checkpoints(member_id);
CREATE INDEX IF NOT EXISTS idx_team_comments_group ON team_comments(team_group_id);
