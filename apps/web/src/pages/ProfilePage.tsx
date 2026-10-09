import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, KeyRound, Mail, Shield, User } from "lucide-react";
import { authClient } from "../lib/auth-client";
import { useAuth } from "../lib/auth";
import { useActiveMembership } from "../lib/profile";
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Separator,
  Skeleton,
} from "@dms/ui";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmNewPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Passwords do not match",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const displayNameSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty"),
});

/**
 * better-auth rejects with an `APIError`, which is an `Error` carrying the
 * server's own message. Showing that verbatim is the point: "Invalid password"
 * tells the user which of the three fields was wrong, where a generic apology
 * would not. Anything else -- a thrown string, a network fault -- has no useful
 * message of its own and gets the caller's fallback.
 */
const refusalMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

export default function ProfilePage() {
  const { user } = useAuth();
  const { membership, isLoading } = useActiveMembership();

  const name = user?.name ?? "";
  const email = user?.username ?? "";

  const [draftName, setDraftName] = useState(name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [savingName, setSavingName] = useState(false);

  // The session refetches after a successful update, so the box follows the
  // server rather than being left holding what was typed.
  useEffect(() => {
    setDraftName(name);
  }, [name]);

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const onSaveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = displayNameSchema.safeParse({ name: draftName });

    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? "Name cannot be empty");
      setNameSaved(false);

      return;
    }

    setSavingName(true);
    setNameError(null);
    setNameSaved(false);

    try {
      await authClient.updateUser({ name: parsed.data.name });
      setNameSaved(true);
    } catch (error) {
      setNameError(refusalMessage(error, "Could not update your name"));
    } finally {
      setSavingName(false);
    }
  };

  const onPasswordSubmit = async (values: ChangePasswordInput) => {
    setSubmittingPassword(true);
    setPasswordError(null);

    try {
      await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      });

      passwordForm.reset();
    } catch (error) {
      setPasswordError(refusalMessage(error, "Could not change your password"));
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Account Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your personal profile and account credentials
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Who you are, and where you work */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Profile Information</CardTitle>
            <CardDescription>
              Your details and where you sit in the business.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-5">
              <Avatar className="size-20">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {initialsOf(name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold text-foreground">{name}</h3>
                <p className="text-sm text-muted-foreground">{email}</p>
                {membership?.role ? (
                  <div className="flex items-center gap-2 mt-1 text-xs font-medium text-primary">
                    <Shield className="size-3.5" aria-hidden="true" />
                    <span>{membership.role}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Building2 className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground">Company</p>
                  {isLoading ? (
                    <Skeleton className="h-5 w-32" />
                  ) : (
                    <p className="font-medium text-foreground">
                      {membership?.organizationName || "No active Company"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* The display name is the one profile field the system can change. */}
            <form onSubmit={onSaveName} className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" aria-hidden="true" />
                <Label htmlFor="display-name">Display name</Label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="display-name"
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value);
                    setNameSaved(false);
                  }}
                  className="sm:max-w-xs"
                  placeholder="Your name"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingName || draftName.trim() === name}
                >
                  {savingName ? "Saving..." : "Save"}
                </Button>
              </div>

              {nameError ? (
                <p role="alert" className="text-xs text-destructive">
                  {nameError}
                </p>
              ) : null}

              {nameSaved ? (
                <p className="text-xs text-emerald-600">Name updated</p>
              ) : null}
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" aria-hidden="true" />
              <CardTitle className="text-lg">Change Password</CardTitle>
            </div>
            <CardDescription>
              Ensure your account is using a secure password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {passwordError ? (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  className="w-full mt-2 cursor-pointer shadow-sm transition-all"
                  disabled={submittingPassword}
                >
                  {submittingPassword ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}