import prisma from "../src/prismaClient.js";
import bcrypt from "bcrypt";
import { validatePasswordPolicy } from "../src/utils/passwordPolicy.js";

async function main() {
  const mockPassword = "river-mango-lamp-47!!";

  const mockPasswordPolicy = validatePasswordPolicy(mockPassword, [
    "mock",
    "student",
    "auss",
    "member",
  ]);

  if (!mockPasswordPolicy.ok) {
    throw new Error(
      `Mock member password is invalid: ${mockPasswordPolicy.error}.`,
    );
  }

  const mockPasswordHash = await bcrypt.hash(
    mockPasswordPolicy.normalizedPassword,
    10,
  );

  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const users = [
    {
      id: "mock-inactive-user-001",
      email: "mock.inactive@example.com",
      membershipStatus: "INACTIVE",
    },
    {
      id: "mock-need-review-user-001",
      email: "mock.needreview@example.com",
      membershipStatus: "IN_REVIEW",
    },
    {
      id: "mock-verified-user-001",
      email: "mock.verified@example.com",
      membershipStatus: "VERIFIED",
    },
    {
      id: "mock-search-kevin-user-001",
      email: "mock.search.kevin@example.com",
      membershipStatus: "VERIFIED",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash: mockPasswordHash,
        role: "USER",
        isVerified: true,
        membershipStatus: user.membershipStatus,
        verificationExpiresAt,
      },
      create: {
        id: user.id,
        email: user.email,
        passwordHash: mockPasswordHash,
        role: "USER",
        isVerified: true,
        membershipStatus: user.membershipStatus,
        lastCodeSentAt: new Date(),
        verificationExpiresAt,
      },
    });
  }

  console.log("[seedMockMembers] Mock membership users inserted.");
  console.log(`[seedMockMembers] Mock member password: ${mockPassword}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[seedMockMembers] Failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
