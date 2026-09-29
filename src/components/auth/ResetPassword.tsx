"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { useState } from "react";
import VerifyEmailForm from "./VerifyEmail";
import { updatePasswordSchema } from "@/validations/schemas";

type PasswordForm = z.infer<typeof updatePasswordSchema>;

export default function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  // const { updatePassword } = useUserMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const onSubmit = async (data: PasswordForm) => {

    // updatePassword(data);
    reset();
    setOpen(false);
    setForgotMode(false);
    alert("Password changed successfully!");
  };

  return (
    <Card className="h-fit border-0 shadow-sm bg-white ">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Security
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1">
              {forgotMode
                ? "Reset your password using email verification"
                : "Update your password to keep your account secure"}
            </CardDescription>
          </div>
          <Button
            variant={open ? "ghost" : "outline"}
            size="sm"
            onClick={() => setOpen(!open)}
            className="ml-4"
          >
            {open ? <X className="h-4 w-4" /> : "Change"}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <div className="pt-0">
          <Separator className="mb-2" />
          <div className="space-y-4 p-3">
            {!forgotMode ? (
              <div>
                {[
                  { field: "currentPassword", label: "Current Password" },
                  { field: "newPassword", label: "New Password" },
                  {
                    field: "confirmNewPassword",
                    label: "Confirm New Password",
                  },
                ].map(({ field, label }) => (
                  <div key={field} className="space-y-2">
                    <Label
                      htmlFor={field}
                      className="text-sm font-medium text-gray-700"
                    >
                      {label}
                    </Label>
                    <Input
                      id={field}
                      type="password"
                      {...register(field as keyof PasswordForm)}
                      placeholder={`Enter ${label.toLowerCase()}`}
                      className="transition-colors focus:ring-2 focus:ring-blue-500"
                    />
                    {errors[field as keyof PasswordForm] && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors[field as keyof PasswordForm]?.message}
                      </p>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center mt-4">
                  <Button
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Processing..." : "Update Password"}
                  </Button>
                  {!forgotMode && (
                    <Button
                      variant="link"
                      className="text-blue-500 text-sm truncate"
                      onClick={() => setForgotMode(true)}
                    >
                      Forgot Current Password?
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <VerifyEmailForm
                setForgotMode={setForgotMode}
              />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
