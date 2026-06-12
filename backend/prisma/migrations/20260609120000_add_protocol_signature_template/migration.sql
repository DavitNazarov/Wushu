-- CreateTable
CREATE TABLE "ProtocolSignatureTemplate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "judgeNameEn" TEXT NOT NULL,
    "judgeNameKa" TEXT,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolSignatureTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProtocolSignatureTemplate_organisationId_idx" ON "ProtocolSignatureTemplate"("organisationId");

-- AddForeignKey
ALTER TABLE "ProtocolSignatureTemplate" ADD CONSTRAINT "ProtocolSignatureTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
