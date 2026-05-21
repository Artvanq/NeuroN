-- Crosspost: thread posted in another field, linking to original
ALTER TABLE "threads" ADD COLUMN "crosspost_of_thread_id" TEXT;

ALTER TABLE "threads" ADD CONSTRAINT "threads_crosspost_of_thread_id_fkey"
  FOREIGN KEY ("crosspost_of_thread_id") REFERENCES "threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "threads_crosspost_of_thread_id_idx" ON "threads"("crosspost_of_thread_id");

-- Poll attached to a thread (one poll per thread)
CREATE TABLE "thread_polls" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_polls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thread_polls_thread_id_key" ON "thread_polls"("thread_id");

ALTER TABLE "thread_polls" ADD CONSTRAINT "thread_polls_thread_id_fkey"
  FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "thread_poll_options" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "thread_poll_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "thread_poll_options_poll_id_idx" ON "thread_poll_options"("poll_id");

ALTER TABLE "thread_poll_options" ADD CONSTRAINT "thread_poll_options_poll_id_fkey"
  FOREIGN KEY ("poll_id") REFERENCES "thread_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "thread_poll_votes" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_poll_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thread_poll_votes_poll_id_user_id_key" ON "thread_poll_votes"("poll_id", "user_id");

CREATE INDEX "thread_poll_votes_option_id_idx" ON "thread_poll_votes"("option_id");

ALTER TABLE "thread_poll_votes" ADD CONSTRAINT "thread_poll_votes_poll_id_fkey"
  FOREIGN KEY ("poll_id") REFERENCES "thread_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "thread_poll_votes" ADD CONSTRAINT "thread_poll_votes_option_id_fkey"
  FOREIGN KEY ("option_id") REFERENCES "thread_poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "thread_poll_votes" ADD CONSTRAINT "thread_poll_votes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
