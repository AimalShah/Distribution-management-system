import { Router } from "express";
import {
  organizationCreateSchema,
  setActiveOrganizationSchema,
} from "@dms/shared";
import { asyncHandler, badRequest, notFound } from "../http";
import {
  createOrganization,
  getActiveOrganization,
  getUserOrganizations,
  setActiveOrganization,
} from "../services/organization";
import { SESSION_HEADER, USER_HEADER } from "../middleware/auth-context";

export const organizationRouter: Router = Router();

/**
 * These routes are mounted behind `bootstrapAuthContext`, not `authContext`, so
 * a caller with no active organization still gets through -- see the comment on
 * that middleware. The consequence is that every value this router needs has to
 * be asked for explicitly, and asked for before the database is touched.
 */
const requireUserId = (userId?: string): string => {
  if (!userId) {
    throw badRequest(
      `Missing user context. Send the ${USER_HEADER} header.`,
      "USER_REQUIRED"
    );
  }
  return userId;
};

const requireSessionId = (sessionId?: string): string => {
  if (!sessionId) {
    throw badRequest(
      `Missing session context. Send the ${SESSION_HEADER} header.`,
      "SESSION_REQUIRED"
    );
  }
  return sessionId;
};

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

    const organization = await getActiveOrganization(userId, sessionId);

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
