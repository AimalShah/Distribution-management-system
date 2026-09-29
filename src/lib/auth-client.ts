import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { auth } from "./auth";

const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), organizationClient(), adminClient()],
});
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
  useActiveOrganization,
} = authClient;
