-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_seed" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inquiries_slug_key" ON "inquiries"("slug");

-- CreateIndex
CREATE INDEX "inquiries_created_by_id_idx" ON "inquiries"("created_by_id");

-- CreateTable
CREATE TABLE "thread_inquiries" (
    "thread_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_inquiries_pkey" PRIMARY KEY ("thread_id","inquiry_id")
);

-- CreateIndex
CREATE INDEX "thread_inquiries_inquiry_id_created_at_idx" ON "thread_inquiries"("inquiry_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_inquiries" ADD CONSTRAINT "thread_inquiries_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_inquiries" ADD CONSTRAINT "thread_inquiries_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
