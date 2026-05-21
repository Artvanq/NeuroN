CREATE TABLE "repo_file_revisions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repo_file_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "repo_file_revisions_lookup_idx" ON "repo_file_revisions"("project_id", "branch", "path", "created_at" DESC);

ALTER TABLE "repo_file_revisions" ADD CONSTRAINT "repo_file_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repo_file_revisions" ADD CONSTRAINT "repo_file_revisions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
