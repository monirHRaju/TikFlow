import { z } from 'zod';

import { EmailSchema, UuidSchema } from './common.js';

export const MemberStatusSchema = z.enum(['active', 'invited', 'suspended', 'deleted']);
export type MemberStatus = z.infer<typeof MemberStatusSchema>;

/**
 * Password policy enforced at sign-up and password change.
 * Mirrors `assertPasswordPolicy` in @tikflow/auth so the form-side
 * validation matches what the server will accept.
 */
export const PasswordSchema = z
  .string()
  .min(12, 'at least 12 characters')
  .max(200)
  .regex(/[a-z]/, 'needs a lowercase letter')
  .regex(/[A-Z]/, 'needs an uppercase letter')
  .regex(/[0-9]/, 'needs a digit');

export const CreateMemberSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  roleIds: z.array(UuidSchema).min(1, 'pick at least one role'),
});
export type CreateMemberInput = z.infer<typeof CreateMemberSchema>;

export const UpdateMemberRolesSchema = z.object({
  roleIds: z.array(UuidSchema).min(1, 'a member must keep at least one role'),
});
export type UpdateMemberRolesInput = z.infer<typeof UpdateMemberRolesSchema>;

export const SetMemberStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});
export type SetMemberStatusInput = z.infer<typeof SetMemberStatusSchema>;

export const MemberSummarySchema = z.object({
  id: UuidSchema,
  email: z.string().email(),
  status: MemberStatusSchema,
  mfaEnabled: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  roles: z.array(
    z.object({
      id: UuidSchema,
      name: z.string(),
    }),
  ),
});
export type MemberSummary = z.infer<typeof MemberSummarySchema>;

export const RoleSummarySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  memberCount: z.number().int().nonnegative(),
  permissions: z.array(
    z.object({
      code: z.string(),
      description: z.string().nullable(),
    }),
  ),
});
export type RoleSummary = z.infer<typeof RoleSummarySchema>;
