/**
 * Request validation (whitelist: .strict() rejects unknown fields).
 * Phone numbers are normalised to the canonical 10-digit local form
 * "0xxxxxxxxx" that users.phone stores (see db/seeds).
 */
import { z } from 'zod';

const VN_MOBILE = /^0[35789]\d{8}$/;

/** "+84 901 000 001", "84901000001", "0901.000.001" → "0901000001"; invalid → null. */
export function normalizeVietnamPhone(input: string): string | null {
  const compact = input.replace(/[\s.\-()]/g, '');
  let local = compact;
  if (compact.startsWith('+84')) local = `0${compact.slice(3)}`;
  else if (compact.startsWith('84') && compact.length === 11) local = `0${compact.slice(2)}`;
  return VN_MOBILE.test(local) ? local : null;
}

export const phoneSchema = z
  .string()
  .max(20)
  .transform((value, ctx) => {
    const normalized = normalizeVietnamPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid Vietnamese mobile number' });
      return z.NEVER;
    }
    return normalized;
  });

const opaqueToken = z.string().min(20).max(200);
const deviceId = z.string().trim().min(1).max(128).optional();

export const requestOtpSchema = z.object({ phone: phoneSchema }).strict();

export const verifyOtpSchema = z
  .object({
    phone: phoneSchema,
    otp: z.string().regex(/^\d{4,10}$/, 'OTP must be digits'),
    deviceId,
  })
  .strict();

export const completeRegistrationSchema = z
  .object({
    registrationToken: opaqueToken,
    fullName: z.string().trim().min(2).max(150),
    role: z.enum(['PATIENT', 'NURSE']),
    deviceId,
  })
  .strict();

export const twoFactorSetupSchema = z.object({ challengeToken: opaqueToken }).strict();

export const verifyTwoFactorSchema = z
  .object({
    challengeToken: opaqueToken,
    code: z.string().regex(/^\d{6}$/, 'Authenticator code must be 6 digits'),
    deviceId,
  })
  .strict();

export const refreshSchema = z.object({ refreshToken: opaqueToken, deviceId }).strict();

export type RequestOtpBody = z.infer<typeof requestOtpSchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpSchema>;
export type CompleteRegistrationBody = z.infer<typeof completeRegistrationSchema>;
export type RefreshBody = z.infer<typeof refreshSchema>;
export type TwoFactorSetupBody = z.infer<typeof twoFactorSetupSchema>;
export type VerifyTwoFactorBody = z.infer<typeof verifyTwoFactorSchema>;
