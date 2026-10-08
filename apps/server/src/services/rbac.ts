import prisma from "@dms/db";
import {
  can,
  DEFAULT_ROLES,
  type CreateRoleInput,
  type PermissionResource,
  type UpdateRoleInput,
  type UpdateRolePermissionsInput,
} from "@dms/shared";
import { badRequest, conflict, notFound } from "../http/errors";
import { MEMBER_ROLES, permissionsForRole } from "../roles";

export async function seedDefaultRoles(organizationId: string) {
  for (const def of Object.values(DEFAULT_ROLES)) {
    const existing = await prisma.role.findFirst({
      where: { organizationId, name: def.name },
    });

    if (!existing) {
      await prisma.role.create({
        data: {
          name: def.name,
          description: def.description,
          organizationId,
          isSystem: true,
          permissions: {
            create: def.permissions.map((p) => ({
              resource: p.resource,
              action: p.action,
            })),
          },
        },
      });
    }
  }
}

/**
 * Everything one member may do in one tenant, resolved in the order the answer
 * can change: no membership at all is nothing, an owner outranks any custom
 * role, a `customRole` speaks for itself, and a bare `Member.role` string is
 * looked up in `roles.ts`.
 *
 * The empty list is the important case. It is what a caller who is not in this
 * organization gets, so the guard built on `checkPermission` denies rather than
 * falls back to a default set.
 */
export async function getMemberPermissions(
  userId: string,
  organizationId: string
): Promise<{ resource: string; action: string }[]> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    include: {
      customRole: {
        include: { permissions: true },
      },
    },
  });

  if (!member) {
    return [];
  }

  // A custom role narrows everyone but an owner. The precedence is ownership
  // first: assigning a role to an owner has to leave the access ownership
  // already grants alone, and only `roles.ts` says what that access is.
  if (member.customRole && member.role !== MEMBER_ROLES.owner) {
    return member.customRole.permissions.map((p) => ({
      resource: p.resource,
      action: p.action,
    }));
  }

  return [...permissionsForRole(member.role)];
}

export async function checkPermission(
  userId: string,
  organizationId: string,
  resource: PermissionResource,
  action: string
): Promise<boolean> {
  const permissions = await getMemberPermissions(userId, organizationId);

  return can(permissions, resource, action);
}

export async function listRoles(organizationId: string) {
  // Ensure default roles exist
  await seedDefaultRoles(organizationId);

  return prisma.role.findMany({
    where: { organizationId },
    include: {
      permissions: {
        select: { id: true, resource: true, action: true },
      },
      _count: {
        select: { members: true },
      },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export async function getRole(id: string, organizationId: string) {
  const role = await prisma.role.findFirst({
    where: { id, organizationId },
    include: {
      permissions: {
        select: { id: true, resource: true, action: true },
      },
      _count: {
        select: { members: true },
      },
    },
  });

  if (!role) {
    throw notFound("Role not found", "ROLE_NOT_FOUND");
  }

  return role;
}

export async function createRole(organizationId: string, data: CreateRoleInput) {
  const existing = await prisma.role.findFirst({
    where: { organizationId, name: data.name },
  });

  if (existing) {
    throw conflict("A role with this name already exists", "ROLE_ALREADY_EXISTS");
  }

  return prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      organizationId,
      isSystem: false,
      permissions: {
        create: (data.permissions || []).map((p) => ({
          resource: p.resource,
          action: p.action,
        })),
      },
    },
    include: {
      permissions: {
        select: { id: true, resource: true, action: true },
      },
    },
  });
}

export async function updateRole(id: string, organizationId: string, data: UpdateRoleInput) {
  const role = await getRole(id, organizationId);

  if (role.isSystem && data.name && data.name !== role.name) {
    throw badRequest("Cannot rename system roles", "CANNOT_RENAME_SYSTEM_ROLE");
  }

  if (data.name && data.name !== role.name) {
    const duplicate = await prisma.role.findFirst({
      where: { organizationId, name: data.name, id: { not: id } },
    });

    if (duplicate) {
      throw conflict("A role with this name already exists", "ROLE_ALREADY_EXISTS");
    }
  }

  return prisma.$transaction(async (tx) => {
    if (data.permissions) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: data.permissions.map((p) => ({
          roleId: id,
          resource: p.resource,
          action: p.action,
        })),
      });
    }

    return tx.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
      },
      include: {
        permissions: {
          select: { id: true, resource: true, action: true },
        },
      },
    });
  });
}

export async function updateRolePermissions(
  id: string,
  organizationId: string,
  data: UpdateRolePermissionsInput
) {
  await getRole(id, organizationId);

  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });

    if (data.permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: data.permissions.map((p) => ({
          roleId: id,
          resource: p.resource,
          action: p.action,
        })),
      });
    }

    return tx.role.findUniqueOrThrow({
      where: { id },
      include: {
        permissions: {
          select: { id: true, resource: true, action: true },
        },
      },
    });
  });
}

export async function deleteRole(id: string, organizationId: string) {
  const role = await getRole(id, organizationId);

  if (role.isSystem) {
    throw badRequest("Cannot delete system roles", "CANNOT_DELETE_SYSTEM_ROLE");
  }

  const memberCount = await prisma.member.count({
    where: { roleId: id },
  });

  if (memberCount > 0) {
    throw conflict("Cannot delete role while members are assigned to it", "ROLE_IN_USE");
  }

  await prisma.role.delete({ where: { id } });
}

export async function assignMemberRole(
  memberId: string,
  roleId: string | null,
  organizationId: string
) {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
  });

  if (!member) {
    throw notFound("Member not found", "MEMBER_NOT_FOUND");
  }

  if (roleId) {
    await getRole(roleId, organizationId);
  }

  return prisma.member.update({
    where: { id: memberId },
    data: { roleId },
    include: {
      customRole: {
        include: { permissions: true },
      },
    },
  });
}
