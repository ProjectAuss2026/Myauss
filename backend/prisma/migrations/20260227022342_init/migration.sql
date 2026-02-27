/*
  Warnings:

  - Added the required column `imgUrl` to the `CommunicationLink` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CommunicationLink" ADD COLUMN     "imgUrl" TEXT NOT NULL;
