-- Store the display name of the person who imported a course
ALTER TABLE ss_courses
ADD COLUMN IF NOT EXISTS "courseImportedBy" VARCHAR(255);
