import { PrismaClient } from '@prisma/client';

import { hashPassword } from '@tikflow/auth';

const prisma = new PrismaClient();

// Local-dev only. Production tenants always set their own password.
const DEMO_OWNER_EMAIL = 'owner@demo.com';
const DEMO_OWNER_PASSWORD = 'tikflow-demo-2026';

// System permission catalogue. Codes follow `<resource>.<action>`.
const PERMISSIONS: Array<{ code: string; description: string }> = [
  { code: 'tenant.read', description: 'View tenant settings' },
  { code: 'tenant.update', description: 'Update tenant settings' },
  { code: 'user.read', description: 'List and view users in the tenant' },
  { code: 'user.invite', description: 'Invite a new user to the tenant' },
  { code: 'user.update', description: "Change a user's profile or status" },
  { code: 'user.delete', description: 'Soft-delete a user' },
  { code: 'role.read', description: 'List roles' },
  { code: 'role.write', description: 'Create / update / delete roles' },
  { code: 'apikey.read', description: 'List API keys' },
  { code: 'apikey.write', description: 'Create / revoke API keys' },
  { code: 'audit.read', description: 'View audit logs' },
  { code: 'security.read', description: 'View security events' },
];

const SYSTEM_ROLES = [
  {
    name: 'owner',
    description: 'Tenant owner — full administrative access.',
    permissions: PERMISSIONS.map((p) => p.code),
  },
  {
    name: 'admin',
    description: 'Administrator — manages users, roles, API keys, settings.',
    permissions: [
      'tenant.read',
      'tenant.update',
      'user.read',
      'user.invite',
      'user.update',
      'user.delete',
      'role.read',
      'role.write',
      'apikey.read',
      'apikey.write',
      'audit.read',
      'security.read',
    ],
  },
  {
    name: 'support',
    description: 'Read-only access to users and audit logs.',
    permissions: ['user.read', 'audit.read'],
  },
];

async function seedPermissions(): Promise<void> {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }
  console.warn(`[seed] permissions: upserted ${String(PERMISSIONS.length)}`);
}

async function seedDevTenant(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const slug = 'demo';
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      name: 'Demo ISP',
      slug,
      country: 'BD',
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      plan: 'trial',
      branding: { primaryColor: '#0ea5e9' },
    },
  });
  console.warn(`[seed] tenant: ${tenant.slug} (${tenant.id})`);

  const allPermissions = await prisma.permission.findMany();
  const permissionByCode = new Map(allPermissions.map((p) => [p.code, p.id]));

  for (const role of SYSTEM_ROLES) {
    const created = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: role.name } },
      update: { description: role.description, isSystem: true },
      create: {
        tenantId: tenant.id,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });

    for (const code of role.permissions) {
      const permissionId = permissionByCode.get(code);
      if (!permissionId) {
        continue;
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: created.id, permissionId } },
        update: {},
        create: { tenantId: tenant.id, roleId: created.id, permissionId },
      });
    }
    console.warn(`[seed] role: ${role.name} (${String(role.permissions.length)} perms)`);
  }

  // Demo owner user: credentials documented in .env.example.
  const ownerRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: 'owner' } },
  });
  if (!ownerRole) {
    throw new Error('owner role missing after seed');
  }

  const passwordHash = await hashPassword(DEMO_OWNER_PASSWORD);
  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: DEMO_OWNER_EMAIL } },
    update: { passwordHash, status: 'active' },
    create: {
      tenantId: tenant.id,
      email: DEMO_OWNER_EMAIL,
      passwordHash,
      status: 'active',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
    update: {},
    create: { tenantId: tenant.id, userId: owner.id, roleId: ownerRole.id },
  });
  console.warn(`[seed] user: ${owner.email} (pw='${DEMO_OWNER_PASSWORD}')`);
}

async function main(): Promise<void> {
  await seedPermissions();
  await seedDevTenant();
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
