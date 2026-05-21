CREATE TABLE "pull_request_review_comments" (
    "id" TEXT NOT NULL,
    "pull_request_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'new',
    "line" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_request_review_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pull_request_review_comments_pull_request_id_path_line_idx" ON "pull_request_review_comments"("pull_request_id", "path", "line");

CREATE INDEX "pull_request_review_comments_pull_request_id_created_at_idx" ON "pull_request_review_comments"("pull_request_id", "created_at");

ALTER TABLE "pull_request_review_comments" ADD CONSTRAINT "pull_request_review_comments_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pull_request_review_comments" ADD CONSTRAINT "pull_request_review_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
