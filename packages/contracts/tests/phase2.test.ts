import { describe, expect, it } from 'vitest';

import { CreateZoneSchema } from '../src/zone.js';
import { CreateServicePlanSchema } from '../src/service-plan.js';
import { CreateSubscriberSchema } from '../src/subscriber.js';
import { CreateInventoryItemSchema } from '../src/inventory.js';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('CreateZoneSchema', () => {
  it('accepts a minimal payload', () => {
    expect(
      CreateZoneSchema.safeParse({
        name: 'Dhaka',
        slug: 'dhaka',
        parentId: null,
        description: null,
      }).success,
    ).toBe(true);
  });
  it('rejects an invalid slug', () => {
    expect(
      CreateZoneSchema.safeParse({
        name: 'Dhaka',
        slug: 'Dhaka City',
        parentId: null,
        description: null,
      }).success,
    ).toBe(false);
  });
});

describe('CreateServicePlanSchema', () => {
  it('accepts a typical residential plan', () => {
    expect(
      CreateServicePlanSchema.safeParse({
        name: 'Home 20',
        code: 'HOME-20',
        description: null,
        type: 'pppoe',
        uploadKbps: 10_000,
        downloadKbps: 20_000,
        burstUploadKbps: null,
        burstDownloadKbps: null,
        validityDays: 30,
        price: 1500,
        vatPct: 5,
        fupLimitGb: null,
        fupThrottleKbps: null,
        mikrotikProfile: null,
        isActive: true,
      }).success,
    ).toBe(true);
  });
  it('rejects negative price', () => {
    expect(
      CreateServicePlanSchema.safeParse({
        name: 'X',
        code: 'X',
        description: null,
        type: 'pppoe',
        uploadKbps: 1,
        downloadKbps: 1,
        burstUploadKbps: null,
        burstDownloadKbps: null,
        validityDays: 30,
        price: -1,
        vatPct: 0,
        fupLimitGb: null,
        fupThrottleKbps: null,
        mikrotikProfile: null,
        isActive: true,
      }).success,
    ).toBe(false);
  });
  it('rejects zero speed', () => {
    expect(
      CreateServicePlanSchema.safeParse({
        name: 'X',
        code: 'X',
        description: null,
        type: 'pppoe',
        uploadKbps: 0,
        downloadKbps: 1,
        burstUploadKbps: null,
        burstDownloadKbps: null,
        validityDays: 30,
        price: 1,
        vatPct: 0,
        fupLimitGb: null,
        fupThrottleKbps: null,
        mikrotikProfile: null,
        isActive: true,
      }).success,
    ).toBe(false);
  });
});

describe('CreateSubscriberSchema', () => {
  it('accepts a minimal payload', () => {
    expect(
      CreateSubscriberSchema.safeParse({
        code: 'SUB-0001',
        fullName: 'Md. Rahim',
        fatherName: null,
        nidNumber: null,
        phone: '+8801711122233',
        altPhone: null,
        email: null,
        address: null,
        zoneId: null,
        installationDate: null,
        connectionType: 'pppoe',
        notes: null,
        planId: UUID,
      }).success,
    ).toBe(true);
  });
  it('rejects invalid phone', () => {
    expect(
      CreateSubscriberSchema.safeParse({
        code: 'SUB-1',
        fullName: 'X',
        fatherName: null,
        nidNumber: null,
        phone: 'not-a-phone',
        altPhone: null,
        email: null,
        address: null,
        zoneId: null,
        installationDate: null,
        connectionType: 'pppoe',
        notes: null,
        planId: null,
      }).success,
    ).toBe(false);
  });
});

describe('CreateInventoryItemSchema', () => {
  it('accepts a valid MAC and required fields', () => {
    expect(
      CreateInventoryItemSchema.safeParse({
        type: 'ont',
        status: 'in_stock',
        serial: 'ABC123',
        mac: 'AA:BB:CC:DD:EE:FF',
        vendor: 'TP-Link',
        model: 'XZ-200',
        location: 'Warehouse A',
        subscriberId: null,
        purchasedAt: null,
        warrantyUntil: null,
        cost: 1200,
        notes: null,
      }).success,
    ).toBe(true);
  });
  it('rejects malformed MAC', () => {
    expect(
      CreateInventoryItemSchema.safeParse({
        type: 'ont',
        status: 'in_stock',
        serial: null,
        mac: 'AA-BB-CC-DD-EE-FF',
        vendor: null,
        model: null,
        location: null,
        subscriberId: null,
        purchasedAt: null,
        warrantyUntil: null,
        cost: null,
        notes: null,
      }).success,
    ).toBe(false);
  });
});
