import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { SignupSchema, type SignupInput } from "@dms/shared";
import { Button, Input, Label } from "@dms/ui";
import { authClient } from "../../lib/auth-client";
import { AuthCard, FieldError } from "./AuthCard";

export default function Signup() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string>();
  const [checkEmail, setCheckEmail] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (values: SignupInput) => {
    setFormError(undefined);
    const { data, error } = await authClient.signUp.email(values);
    if (error) {
      setFormError(error.message ?? "Sign up failed.");
      return;
    }
    // With email verification on, better-auth creates the user but no session,
    // so there is nothing to navigate into yet.
    if (!data?.token) {
      setCheckEmail(true);
      return;
    }
    navigate("/register", { replace: true });
  };

  if (checkEmail) {
    return (
      <AuthCard
        title="Check your email"
        description="We sent you a verification link. Follow it, then sign in."
        footer={<Link to="/login" className="underline">Back to login</Link>}
      >
        {null}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create an account"
      footer={
        <>
          Already have an account? <Link to="/login" className="underline">Log in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...register("password")} />
          <FieldError message={errors.password?.message} />
        </div>
        <FieldError message={formError} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Sign up"}
        </Button>
      </form>
    </AuthCard>
  );
}
