ALTER TABLE "categories" ADD COLUMN "created_by_id" TEXT;

CREATE INDEX "categories_created_by_id_idx" ON "categories"("created_by_id");

ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
