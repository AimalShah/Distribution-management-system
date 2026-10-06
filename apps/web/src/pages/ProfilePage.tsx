import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Mail, MapPin, Phone, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import {
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
  Separator,
} from "@dms/ui";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "Current password must be at least 6 characters"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmNewPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Passwords do not match",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState({
    name: authUser?.name ?? "IJAZ",
    email: authUser?.username ?? "alex.morgan@inventioo.test",
    role: "Administrator",
    phone: "+1 (555) 234-5678",
    city: "Chicago, IL",
    organization: "Apex Wholesale Distribution",
  });

  const [submittingPassword, setSubmittingPassword] = useState(false);

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const onPasswordSubmit = async (values: ChangePasswordInput) => {
    setSubmittingPassword(true);
    try {
      // Simulate or call API to update password
      await new Promise((resolve) => setTimeout(resolve, 300));
      toast.success("Password changed successfully");
      passwordForm.reset();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl animate-slideInUp">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span className="hover:text-primary transition-colors cursor-pointer">
            Dashboard
          </span>
          <span>/</span>
          <span className="text-muted-foreground">Admin</span>
          <span>/</span>
          <span className="text-foreground font-semibold">Account Settings</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Account Settings</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your personal profile and account credentials
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Profile Information</CardTitle>
            <CardDescription>
              Personal details and organization membership.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-5">
              <Avatar className="size-20">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold text-foreground">{user.name}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="flex items-center gap-2 mt-1 text-xs font-medium text-primary">
                  <Shield className="size-3.5" />
                  <span>{user.role}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{user.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium text-foreground">{user.city}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Organization</p>
                  <p className="font-medium text-foreground">{user.organization}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
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
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
