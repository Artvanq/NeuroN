-- AlterTable
ALTER TABLE "threads" ADD COLUMN "is_pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "project_issue_templates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_issue_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_stars" (
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_stars_pkey" PRIMARY KEY ("user_id","project_id")
);

-- CreateTable
CREATE TABLE "project_watches" (
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_watches_pkey" PRIMARY KEY ("user_id","project_id")
);

-- CreateIndex
CREATE INDEX "project_issue_templates_project_id_idx" ON "project_issue_templates"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_issue_templates_project_id_name_key" ON "project_issue_templates"("project_id", "name");

-- CreateIndex
CREATE INDEX "project_stars_project_id_idx" ON "project_stars"("project_id");

-- CreateIndex
CREATE INDEX "project_watches_project_id_idx" ON "project_watches"("project_id");

-- CreateIndex
CREATE INDEX "threads_is_pinned_created_at_idx" ON "threads"("is_pinned" DESC, "created_at" DESC);

-- AddForeignKey
ALTER TABLE "project_issue_templates" ADD CONSTRAINT "project_issue_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stars" ADD CONSTRAINT "project_stars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stars" ADD CONSTRAINT "project_stars_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_watches" ADD CONSTRAINT "project_watches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_watches" ADD CONSTRAINT "project_watches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
