"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Pencil, X, User, Building, Phone, MapPin, Mail } from "lucide-react";
import { demoProfile } from "@/lib/data/mock-data";
import { useEffect, useRef, useState } from "react";
import { profileSchema } from "@/validations/schemas";

export type ProfileForm = z.infer<typeof profileSchema>;

function FieldRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      {Icon && <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
      <div className="flex-1 grid grid-cols-3 gap-4">
        <div className="font-medium text-gray-600 text-sm">{label}</div>
        <div className="col-span-2 text-gray-900">{value ?? "—"}</div>
      </div>
    </div>
  );
}

function AvatarUploader({
  url,
  disabled,
  onChange,
}: {
  url?: string;
  disabled?: boolean;
  onChange?: (file: File | null, preview?: string) => void;
}) {
  const [preview, setPreview] = useState(url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(url);
      onChange?.(null, undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    onChange?.(file, objectUrl);
  };

  return (
    <div className="flex items-center gap-6">
      <Avatar className="h-20 w-20 ring-2 ring-gray-100">
        {preview ? (
          <AvatarImage
            src={preview}
            alt="Avatar preview"
            className="object-cover"
          />
        ) : (
          <AvatarFallback className="text-lg bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700">
            <User className="h-8 w-8" />
          </AvatarFallback>
        )}
      </Avatar>
      <div className="flex-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="mb-2"
        >
          Change Photo
        </Button>
        <p className="text-xs text-gray-500">JPG, PNG or GIF. Max size 2MB.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          disabled={disabled}
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}

type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null | undefined;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string | null | undefined;
  isOwner?: boolean | null | undefined;
  isFormComplete?: boolean | null | undefined;
  role?: string | null | undefined;
  banned?: boolean | null | undefined;
  banReason?: string | null | undefined;
  banExpires?: Date | null | undefined;
};

export default function ProfileCard({ user }: { user: User }) {
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>();
  const profile = demoProfile as ProfileForm;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: profile ?? demoProfile,
  });

  useEffect(() => {
    if (profile) reset(profile);
  }, [profile, reset]);

  const onSubmit = (data: ProfileForm) => {
    console.log("Profile updated:", {
      ...data,
      avatarUrl: avatarPreview || data.avatarUrl,
    });
    setIsEditing(false);
  };

  const fieldIcons = {
    email: Mail,
    companyName: Building,
    companyPhone: Phone,
    companyAddress: MapPin,
    city: MapPin,
  };

  return (
    <div className="lg:col-span-2">
      <Card className="border-0 shadow-sm bg-white ">
        <CardHeader className="pb-6">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                Profile Information
              </CardTitle>
              <CardDescription className="text-sm text-gray-500 mt-2">
                Update your personal and company details
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              {isEditing ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {!isEditing ? (
            <div className="space-y-6">
              <div className="flex items-center gap-6 pb-6">
                <Avatar className="h-20 w-20 ring-2 ring-gray-100">
                  {profile.avatarUrl ? (
                    <AvatarImage
                      src={profile.avatarUrl}
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="text-lg bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700">
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {user?.name}
                  </h3>
                  <p className="text-gray-500 text-sm">{user?.email}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <FieldRow
                  label="Email Address"
                  value={user?.email}
                  icon={fieldIcons.email}
                />
                <FieldRow
                  label="Company"
                  value={profile.companyName}
                  icon={fieldIcons.companyName}
                />
                <FieldRow
                  label="Phone Number"
                  value={profile.companyPhone}
                  icon={fieldIcons.companyPhone}
                />
                <FieldRow
                  label="Address"
                  value={profile.companyAddress}
                  icon={fieldIcons.companyAddress}
                />
                <FieldRow
                  label="City"
                  value={profile.city}
                  icon={fieldIcons.city}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Profile Photo
                </Label>
                <AvatarUploader
                  url={profile.avatarUrl}
                  disabled={isSubmitting}
                  onChange={(file, preview) => setAvatarPreview(preview)}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    field: "name",
                    label: "Full Name",
                    span: "col-span-1",
                  },
                  {
                    field: "email",
                    label: "Email Address",
                    span: "col-span-1",
                    type: "email",
                  },
                  {
                    field: "companyName",
                    label: "Company Name",
                    span: "col-span-1",
                  },
                  {
                    field: "companyPhone",
                    label: "Phone Number",
                    span: "col-span-1",
                    type: "tel",
                  },
                  {
                    field: "companyAddress",
                    label: "Address",
                    span: "md:col-span-2",
                  },
                  { field: "city", label: "City", span: "col-span-1" },
                ].map(({ field, label, span, type = "text" }) => (
                  <div key={field} className={`space-y-2 ${span}`}>
                    <Label
                      htmlFor={field}
                      className="text-sm font-medium text-gray-700"
                    >
                      {label}
                    </Label>
                    <Input
                      id={field}
                      type={type}
                      placeholder={`Enter ${label.toLowerCase()}`}
                      {...register(field as keyof ProfileForm)}
                      className="transition-colors focus:ring-2 focus:ring-blue-500"
                    />
                    {errors[field as keyof ProfileForm] && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors[field as keyof ProfileForm]?.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
