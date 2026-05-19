-- 021_scholarsync_alignment.sql
-- Alignment of ss_* tables based on user-provided definitions

-- 1. Create missing tables
CREATE TABLE IF NOT EXISTS public.ss_attendance (
  att_id serial not null,
  "conID" integer null,
  one_id integer null,
  mem1 text null,
  two_id integer null,
  mem2 text null,
  three_id integer null,
  mem3 text null,
  four_id integer null,
  mem4 text null,
  five_id integer null,
  mem5 text null,
  constraint ss_attendance_pkey primary key (att_id)
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.ss_consultation (
  "conID" serial not null,
  "courseID" integer null,
  "groupName" text null,
  "conDate" text null,
  "conType" text null,
  "conMil" text null,
  "conSum" text null,
  "conAction" text null,
  "conAtt" text null,
  "isDraft" boolean null default false,
  "conStat" text null,
  "conNotes" text null,
  constraint ss_consultation_pkey primary key ("conID")
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.ss_group (
  "smallgroupID" serial not null,
  "groupName" text null,
  member1 text null,
  "roleOne" text null,
  member2 text null,
  "roleTwo" text null,
  member3 text null,
  "roleThree" text null,
  member4 text null,
  "roleFour" text null,
  member5 text null,
  "roleFive" text null,
  constraint ss_group_pkey primary key ("smallgroupID"),
  constraint ss_group_groupName_key unique ("groupName")
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.ss_grouptasks (
  "taskID" serial not null,
  "groupId" integer null,
  "taskTitle" text null,
  "taskAssign" text null,
  "taskDeadline" text null,
  "taskInfo" text null,
  "progressRating" integer null,
  comments jsonb null,
  completed boolean null default false,
  archived boolean null default false,
  constraint ss_grouptasks_pkey primary key ("taskID"),
  constraint ss_grouptasks_progressRating_check check (
    (
      ("progressRating" >= 1)
      and ("progressRating" <= 5)
    )
  )
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.ss_member_journals (
  id serial not null,
  "courseID" integer not null,
  "groupName" text not null,
  member_email text not null,
  journal_date date not null,
  task_updates jsonb not null default '[]'::jsonb,
  action_plans jsonb not null default '[]'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  minutes_date date null,
  minutes_adviser text null,
  minutes_key_points text null,
  minutes_action_items text null,
  minutes_action_deadlines text null,
  next_consultation date null,
  constraint ss_member_journals_pkey primary key (id)
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.ss_participation (
  part_id serial not null,
  "conID" integer null,
  mem1 integer null,
  part1 text null,
  mem2 integer null,
  part2 text null,
  mem3 integer null,
  part3 text null,
  mem4 integer null,
  part4 text null,
  mem5 integer null,
  part5 text null,
  constraint ss_participation_pkey primary key (part_id)
) TABLESPACE pg_default;

-- 2. Align existing tables
DO $$ 
BEGIN 
    -- ss_account
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ss_account' AND column_name='googleRefreshToken') THEN
        ALTER TABLE public.ss_account ADD COLUMN "googleRefreshToken" text null;
    END IF;

    -- ss_courses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ss_courses' AND column_name='courseSheetUrl') THEN
        ALTER TABLE public.ss_courses ADD COLUMN "courseSheetUrl" text null;
    END IF;

    -- ss_groupings
    -- Change groupMembers from integer to text
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ss_groupings' AND column_name='groupMembers' AND data_type='integer') THEN
        ALTER TABLE public.ss_groupings ALTER COLUMN "groupMembers" TYPE text USING "groupMembers"::text;
    END IF;
END $$;

-- 3. Add foreign keys (if not exists logic handled by manual check or trust)
-- Note: Applying keys after tables are created to ensure dependencies exist
ALTER TABLE public.ss_attendance DROP CONSTRAINT IF EXISTS ss_attendance_conId_fkey;
ALTER TABLE public.ss_attendance ADD CONSTRAINT ss_attendance_conId_fkey FOREIGN KEY ("conID") REFERENCES ss_consultation ("conID");

ALTER TABLE public.ss_consultation DROP CONSTRAINT IF EXISTS ss_consultation_courseId_fkey;
ALTER TABLE public.ss_consultation ADD CONSTRAINT ss_consultation_courseId_fkey FOREIGN KEY ("courseID") REFERENCES ss_courses (id);

ALTER TABLE public.ss_grouptasks DROP CONSTRAINT IF EXISTS ss_grouptasks_groupId_fkey;
ALTER TABLE public.ss_grouptasks ADD CONSTRAINT ss_grouptasks_groupId_fkey FOREIGN KEY ("groupId") REFERENCES ss_group ("smallgroupID");

ALTER TABLE public.ss_member_journals DROP CONSTRAINT IF EXISTS ss_member_journals_courseID_fkey;
ALTER TABLE public.ss_member_journals ADD CONSTRAINT ss_member_journals_courseID_fkey FOREIGN KEY ("courseID") REFERENCES ss_courses (id) ON DELETE CASCADE;

ALTER TABLE public.ss_member_journals DROP CONSTRAINT IF EXISTS ss_member_journals_member_email_fkey;
ALTER TABLE public.ss_member_journals ADD CONSTRAINT ss_member_journals_member_email_fkey FOREIGN KEY (member_email) REFERENCES ss_account ("accountEmail") ON DELETE CASCADE;

ALTER TABLE public.ss_participation DROP CONSTRAINT IF EXISTS ss_participation_conId_fkey;
ALTER TABLE public.ss_participation ADD CONSTRAINT ss_participation_conId_fkey FOREIGN KEY ("conID") REFERENCES ss_consultation ("conID");
