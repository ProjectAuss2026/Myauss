import { z } from "zod";
import {
  LIMITS,
  requiredTrimmedString,
  optionalTrimmedString,
} from "./commonSchemas.js";

const email = requiredTrimmedString("Email", LIMITS.email).email({
  message: "Email must be a valid email address",
});
const password = z
  .string()
  .min(6, { message: "Password must be at least 6 characters" })
  .max(LIMITS.password, {
    message: `Password must be ${LIMITS.password} characters or fewer`,
  });
const paymentProofUploadId = z
  .string()
  .trim()
  .uuid({ message: "Each payment proof upload ID must be a valid ID" });

export const registerBodySchema = z
  .object({
    email,
    password,
    role: z.enum(["executive"]).optional(),
    execCode: optionalTrimmedString(
      "Executive invitation code",
      LIMITS.execCode,
    ),
    firstName: requiredTrimmedString("First name", LIMITS.personName),
    lastName: requiredTrimmedString("Last name", LIMITS.personName),
    studentId: requiredTrimmedString("Student ID", LIMITS.studentId),
    paymentMethod: z.enum(["CASH_BANK_TRANSFER"]).optional(),
    proofUploadIds: z
      .array(paymentProofUploadId)
      .max(10, { message: "You can upload at most 10 payment proof files" })
      .optional(),
  })
  .superRefine((body, ctx) => {
    const proofUploadIds = body.proofUploadIds ?? [];

    if (
      body.paymentMethod === "CASH_BANK_TRANSFER" &&
      proofUploadIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proofUploadIds"],
        message:
          "At least one payment proof upload is required for Cash / Bank Transfer",
      });
    }

    if (
      body.paymentMethod !== "CASH_BANK_TRANSFER" &&
      proofUploadIds.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proofUploadIds"],
        message:
          "Payment proof uploads can only be submitted with Cash / Bank Transfer",
      });
    }
  });

export const loginBodySchema = z.object({
  email,
  password,
});

export const resendCodeBodySchema = z.object({
  email,
});

export const verifyBodySchema = z.object({
  email,
  code: requiredTrimmedString("Verification code", 6).regex(/^\d{6}$/, {
    message: "Verification code must be 6 digits",
  }),
});

export const registerSchema = { body: registerBodySchema };
export const loginSchema = { body: loginBodySchema };
export const resendCodeSchema = { body: resendCodeBodySchema };
export const verifySchema = { body: verifyBodySchema };
