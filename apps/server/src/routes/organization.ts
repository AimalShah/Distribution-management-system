import { Router } from "express";
import {
  organizationCreateSchema,
  organizationUpdateSchema,
  setActiveOrganizationSchema,
} from "@dms/shared";
import { asyncHandler, notFound } from "../http";
import {
  createOrganization,
  findActiveOrganization,
  getUserOrganizations,
  setActiveOrganization,
  updateOrganization,
} from "../services/organization";
import { requireSessionId, requireUserId } from "../middleware/auth-context";

export const organizationRouter: Router = Router();

/**
 * The legacy `getUserOrganization` fell back to `prisma.organization.findMany()`
 * with no filter when the caller had no memberships, which answered with every
 * organization in the installation. There is no fallback here: no memberships is
 * a real answer, and it is the state POST /organizations exists to fix.
 */
organizationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req.auth.userId);
    res.json(await getUserOrganizations(userId));
  })
);

/**
 * The legacy `getCurrentActiveOrganization` read the session's
 * `activeOrganizationId` and then fell back to `organization.findFirst()` -- the
 * first row in the table -- when the session had not chosen one. So a brand new
 * user with no active organization was shown somebody else's organization.
 *
 * There is no fallback. No session, no choice, or a choice the user is no longer
 * a member of, all answer 404 with no row, and the client asks them to pick or
 * create one.
 */
organizationRouter.get(
  "/active",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req.auth.userId);
    const sessionId = requireSessionId(req.auth.sessionId);

    const organization = await findActiveOrganization(userId, sessionId);

    if (!organization) {
      throw notFound(
        "No active organization. Choose one or create an organization first.",
        "NO_ACTIVE_ORGANIZATION"
      );
    }

    res.json(organization);
  })
);

organizationRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req.auth.userId);
    const data = organizationCreateSchema.parse(req.body);

    // 201 rather than the legacy's `{ success, message }` envelope: the envelope
    // said nothing about what was created, and every route in this API answers
    // with the resource.
    const organization = await createOrganization(data, userId);
    res.status(201).json(organization);
  })
);

organizationRouter.post(
  "/set-active",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req.auth.userId);
    const sessionId = requireSessionId(req.auth.sessionId);
    const { organizationId } = setActiveOrganizationSchema.parse(req.body);

    await setActiveOrganization(organizationId, userId, sessionId);
    res.status(204).send();
  })
);

organizationRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req.auth.userId);
    const data = organizationUpdateSchema.parse(req.body);

    const organization = await updateOrganization(req.params.id, data, userId);
    res.json(organization);
  })
);
