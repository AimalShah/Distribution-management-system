"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyEmailSchema } from "@/validations/schemas";

type VerifyEmail = z.infer<typeof verifyEmailSchema>;
interface VerifyEmailProps {
  setForgotMode: (mode: boolean) => void;
}
export default function VerifyEmailForm({ setForgotMode }: VerifyEmailProps) {

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmail>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: VerifyEmail) => {
  };
  return (
    <Card className="h-fit border-0 shadow-none  ">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          {...register("email" as keyof VerifyEmail)}
          placeholder="Enter your email"
          className="transition-colors focus:ring-2 focus:ring-blue-500"
        />
        {"email" in errors && (
          <p className="text-red-500 text-xs mt-1">{errors.email?.message}</p>
        )}
      </div>
      <div className="flex justify-between items-center mt-4">
        <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
          {isSubmitting ? "sending..." : "Send link"}
        </Button>
        <Button
          className="text-white text-sm bg-green-700 hover:bg-green-800 mr-3"
          onClick={() => setForgotMode(false)}
        >
          Now update Password
        </Button>
      </div>
    </Card>
  );
}
