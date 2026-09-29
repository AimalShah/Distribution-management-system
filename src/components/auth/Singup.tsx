"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { signUp, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SignupForm, SingupSchema } from "@/validations/schemas";


export default function Singup() {
  const router = useRouter();
  const session = useSession();
  const hasCheckedInitially = useRef(false);

  useEffect(() => {
    if (!hasCheckedInitially.current && session.data) {
      hasCheckedInitially.current = true;
      router.push("/dashboard");
    }
  }, [session, router]);

  const form = useForm<SignupForm>({
    resolver: zodResolver(SingupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: SignupForm) {
    try {
      await signUp.email(
        {
          name: values.name,
          email: values.email,
          password: values.password,
          isOwner: true,
          isFormComplete: false,
        },
        {
          onError: (ctx) => {
            toast.error(ctx.error.message);
          },
          onSuccess: () => {
            toast.success("Verification email has been sent to your inbox.");
          },
        }
      );
    } catch (error) {
      console.error("Form submission error", error);
      toast.error("Failed to submit the form. Please try again.");
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 dark:text-gray-300">
                  Full Name
                </FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 dark:text-gray-300">
                  Email Address
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="you@example.com"
                    type="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 dark:text-gray-300">
                  Password
                </FormLabel>
                <FormControl>
                  <Input type="password" placeholder="********" {...field} />
                </FormControl>
                <FormDescription className="text-gray-500 dark:text-gray-400">
                  Must be at least 8 characters long.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full"
          >
            {form.formState.isSubmitting ? "Creating Account..." : "Sign Up"}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-sm text-center text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <a
          href="/login"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Log in
        </a>
      </p>
    </>
  );
}
