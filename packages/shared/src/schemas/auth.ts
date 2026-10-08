import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
});

export const SignupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterCompanySchema = z.object({
  companyName: z.string(),
  companySlug: z.string(),
  companyAddress: z.string(),
  city: z.string(),
  companyPhone: z.string(),
});

export const ProfileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  companyName: z.string(),
  companyAddress: z.string(),
  city: z.string(),
  companyPhone: z.string(),
  avatarUrl: z.string().url().optional(),
});

export const UpdatePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8),
  confirmNewPassword: z.string().min(8),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
});

export type LoginInput = z.infer<typeof LoginSchema>;

export type SignupInput = z.infer<typeof SignupSchema>;

export type RegisterCompanyInput = z.infer<typeof RegisterCompanySchema>;

export type ProfileInput = z.infer<typeof ProfileSchema>;

export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
