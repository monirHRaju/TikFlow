import { describe, expect, it } from 'vitest';

import {
  CreateMemberSchema,
  PasswordSchema,
  SetMemberStatusSchema,
  UpdateMemberRolesSchema,
} from '../src/member.js';

describe('PasswordSchema', () => {
  it('rejects shorter than 12 chars', () => {
    expect(PasswordSchema.safeParse('Abc12345').success).toBe(false);
  });
  it('rejects when missing uppercase', () => {
    expect(PasswordSchema.safeParse('abcdefghij12').success).toBe(false);
  });
  it('rejects when missing lowercase', () => {
    expect(PasswordSchema.safeParse('ABCDEFGHIJ12').success).toBe(false);
  });
  it('rejects when missing digit', () => {
    expect(PasswordSchema.safeParse('Abcdefghijkl').success).toBe(false);
  });
  it('accepts a strong password', () => {
    expect(PasswordSchema.safeParse('Tikflow2026!ok').success).toBe(true);
  });
});

describe('CreateMemberSchema', () => {
  it('requires at least one role', () => {
    expect(
      CreateMemberSchema.safeParse({
        email: 'a@b.com',
        password: 'Tikflow2026!ok',
        roleIds: [],
      }).success,
    ).toBe(false);
  });
  it('accepts a valid payload', () => {
    expect(
      CreateMemberSchema.safeParse({
        email: 'noc@acme.net',
        password: 'Tikflow2026!ok',
        roleIds: ['11111111-1111-1111-1111-111111111111'],
      }).success,
    ).toBe(true);
  });
  it('rejects non-uuid role id', () => {
    expect(
      CreateMemberSchema.safeParse({
        email: 'noc@acme.net',
        password: 'Tikflow2026!ok',
        roleIds: ['not-a-uuid'],
      }).success,
    ).toBe(false);
  });
});

describe('UpdateMemberRolesSchema', () => {
  it('rejects empty role list (would orphan the member)', () => {
    expect(UpdateMemberRolesSchema.safeParse({ roleIds: [] }).success).toBe(false);
  });
});

describe('SetMemberStatusSchema', () => {
  it.each(['active', 'suspended'])('accepts %s', (s) => {
    expect(SetMemberStatusSchema.safeParse({ status: s }).success).toBe(true);
  });
  it('rejects deleted (handled by a different flow)', () => {
    expect(SetMemberStatusSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });
});
