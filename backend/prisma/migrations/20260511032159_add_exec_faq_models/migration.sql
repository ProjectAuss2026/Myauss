-- CreateTable
CREATE TABLE "ExecRole" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecTeam" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Executive" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "bio" VARCHAR(300),
    "instagramUrl" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Executive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" SERIAL NOT NULL,
    "question" VARCHAR(300) NOT NULL,
    "answer" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecRole_name_key" ON "ExecRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExecTeam_name_key" ON "ExecTeam"("name");

-- AddForeignKey
ALTER TABLE "Executive" ADD CONSTRAINT "Executive_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ExecRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Executive" ADD CONSTRAINT "Executive_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ExecTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
