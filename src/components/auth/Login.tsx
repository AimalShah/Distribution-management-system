"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { loginSchema } from "@/validations/schemas";

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginForm) => {
    await signIn.email(
      {
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      },
      {
        onError: (ctx) => {
          if (ctx.error.status === 410) {
            toast.error("Please verify your email address");
          }

          toast.error(ctx.error.message);
        },
        onSuccess: () => {
          toast.success("Login successful");
          router.push("/dashboard");
        },
      }
    );
  };

  return (
    <div className="flex px-4 w-full">
      <Card className="w-full border-none shadow-none">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-center">
            Login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                required
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                {...register("password")}
                type="password"
                placeholder="********"
                required
              />
              {errors.password && (
                <p className="text-sm text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" {...register("rememberMe")} />
              <label htmlFor="remember" className="cursor-pointer text-sm">
                Remember me
              </label>
            </div>
            <Button
              type="submit"
              className="w-full mt-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing In..." : "Sign In"}
            </Button>
          </form>
          <p>
            Dont have an account?{" "}
            <a href="/signup" className="underline">
              Signup
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
