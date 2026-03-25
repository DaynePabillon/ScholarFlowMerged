-- Migration: 020_scholarsync.sql
-- Adds ScholarSync tables to the shared SkyFlow PostgreSQL database
-- Uses quoted identifiers to preserve camelCase matching the frontend/backend TS types

-- 1. Accounts Table (Students, Advisers, Admins)
CREATE TABLE IF NOT EXISTS ss_account (
    account_id SERIAL PRIMARY KEY,
    "accountName" VARCHAR(255) NOT NULL,
    "accountEmail" VARCHAR(255) UNIQUE NOT NULL,
    "accountRole" VARCHAR(50) DEFAULT 'Student',
    "accountGroup" VARCHAR(255),
    "googleAccessToken" TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses Table
CREATE TABLE IF NOT EXISTS ss_courses (
    id SERIAL PRIMARY KEY,
    "courseName" VARCHAR(255) NOT NULL,
    "courseCode" VARCHAR(50) NOT NULL,
    "courseSection" VARCHAR(50) NOT NULL,
    "courseTerm" VARCHAR(50) NOT NULL,
    "courseAdviser" VARCHAR(255),
    "courseKey" VARCHAR(50) UNIQUE NOT NULL,
    "courseAmount" INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enrollments Table (Many-to-Many between Accounts and Courses)
CREATE TABLE IF NOT EXISTS ss_enrollments (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES ss_account(account_id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES ss_courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, course_id)
);

-- 4. Groupings Table
CREATE TABLE IF NOT EXISTS ss_groupings (
    "groupID" SERIAL PRIMARY KEY,
    "groupName" VARCHAR(255) NOT NULL,
    "groupMembers" INTEGER DEFAULT 0,
    "courseID" INTEGER REFERENCES ss_courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Connected Sheets Table (Workspace Sync)
CREATE TABLE IF NOT EXISTS ss_connected_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "courseID" INTEGER NOT NULL REFERENCES ss_courses(id) ON DELETE CASCADE,
    "sheetId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL DEFAULT 'Connected Sheet',
    "groupCount" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("courseID", "sheetId")
);
