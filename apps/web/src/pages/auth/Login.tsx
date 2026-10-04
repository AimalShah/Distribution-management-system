import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LoginSchema, type LoginInput } from "@dms/shared";
import { Button, Input, Label } from "@dms/ui";
import { authClient } from "../../lib/auth-client";
import { AuthCard, FieldError } from "./AuthCard";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = async (values: LoginInput) => {
    setFormError(undefined);
    const { error } = await authClient.signIn.email(values);
    if (error) {
      // 403 is better-auth's answer for an unverified email; the legacy checked
      // for 410, which it never sends, so that hint was never shown.
      setFormError(
        error.status === 403
          ? "Please verify your email address. Check your inbox for the link."
          : error.message ?? "Sign in failed."
      );
      return;
    }
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== "/login" ? from : "/dashboard", { replace: true });
  };

  return (
    <AuthCard
      title="Login"
      footer={
        <>
          Don&apos;t have an account? <Link to="/signup" className="underline">Sign up</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...register("password")} />
          <FieldError message={errors.password?.message} />
        </div>
        <div className="flex items-center gap-2">
          <input id="rememberMe" type="checkbox" {...register("rememberMe")} />
          <Label htmlFor="rememberMe" className="cursor-pointer font-normal">
            Remember me
          </Label>
        </div>
        <FieldError message={formError} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
