import { Router } from "express";
import {
  addMemberSchema,
  addStaffSchema,
  setMemberStatusSchema,
  updateMemberRoleSchema,
} from "@dms/shared";
import { asyncHandler } from "../http";
import {
  addMember,
  listAvailableUsers,
  listMembers,
  removeMember,
  updateMemberRole,
} from "../services/member";
import { requireUserId } from "../middleware/auth-context";
import { createStaff, setMemberStatus } from "../services/user-provisioning";

/**
 * The two org-scoped member routes. Mounted inside the `/api/organizations`
 * stack, ahead of `organizationRouter`, so `GET /api/organizations/:id/members`
 * reaches this router rather than the `notFoundHandler` that terminates that
 * mount.
 */
export const organizationMemberRouter: Router = Router();

/**
 * The two by-id member routes, mounted at `/api/members`.
 */
export const memberRouter: Router = Router();

/**
 * Mounted behind `bootstrapAuthContext` rather than the strict `authContext`,
 * and that is a deliberate difference from the other twelve routers.
 *
 * Everywhere else the tenant comes from `x-organization-id`, so the strict
 * middleware is the right guard. Here the organization is named in the path
 * (`:id`) or, for the by-id routes, read from the member row -- which is
 * stronger than anything a client header can assert, because it is the row's
 * own column. Requiring a header on top would add a second source of tenant
 * truth that can contradict the first, and a caller would have to send the org
 * twice, in two places, to get one operation right.
 *
 * What is *not* optional is the caller. Every route here acts on somebody's
 * membership, so `requireUserId` runs first and answers 400 USER_REQUIRED
 * before any query, and the service then resolves the caller's own membership to
 * decide what they may do. Checkpoint 3 replaces the stand-in middleware; the
 * role check in the service is the part that has to survive that swap.
 */
organizationMemberRouter.get(
  "/:id/members",
  asyncHandler(async (req, res) => {
    const callerUserId = requireUserId(req.auth.userId);
    res.json(await listMembers(req.params.id, callerUserId));
  })
);

organizationMemberRouter.get(
  "/:id/available-users",
  asyncHandler(async (req, res) => {
    const callerUserId = requireUserId(req.auth.userId);
    res.json(await listAvailableUsers(req.params.id, callerUserId));
  })
);

organizationMemberRouter.post(
  "/:id/members",
  asyncHandler(async (req, res) => {
    const callerUserId = requireUserId(req.auth.userId);
    const data = addMemberSchema.parse(req.body);

    const member = await addMember(req.params.id, data, callerUserId);

    res.status(201).json(member);
  })
);

/**
 * P0-5: create the staff account itself. The tenant is named in the path, so
 * this lives on the same mount as the other membership routes -- only now the
 * account does not have to exist first, which is the reason a fresh tenant
 * could never staff itself.
 */
organizationMemberRouter.post(
  "/:id/staff",
  asyncHandler(async (req, res) => {
    const callerUserId = requireUserId(req.auth.userId);
    const data = addStaffSchema.parse(req.body);

    const user = await createStaff(req.params.id, data, callerUserId);

    res.status(201).json(user);
  })
);

memberRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const callerUserId = requireUserId(req.auth.userId);

    await removeMember(req.params.id, callerUserId);

    res.status(204).send();
  })
);

/**
 * Not in the 2k plan, which listed four routes. The service explains why: the
 * legacy server set `Member.role` on insert and never again, so there was no way
 * to correct a mislabelled member except removing and re-adding them.
 */
memberRouter.patch(
  "/:id/role",
  asyncHandler(async (req, res) => {
    const callerUserId = requireUserId(req.auth.userId);
    const data = updateMemberRoleSchema.parse(req.body);

    const member = await updateMemberRole(req.params.id, data, callerUserId);

    res.json(member);
  })
);

/**
 * P0-5: deactivate/reactivate a member. The row and its history stay; the user
 * loses their sessions and is refused at every authenticated route until
 * reactivated. Scoped by member id the same way as the role route above.
 */
memberRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const callerUserId = requireUserId(req.auth.userId);
    const data = setMemberStatusSchema.parse(req.body);

    const result = await setMemberStatus(req.params.id, data, callerUserId);

    res.json(result);
  })
);
