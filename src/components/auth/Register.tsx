"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createOrganization } from "@/actions/organization";
import { useRouter } from "next/navigation";
import { registerCompanySchema } from "@/validations/schemas";

type RegisterForm = z.infer<typeof registerCompanySchema>;

export default function Register() {
  const router = useRouter();
  const {
    register: formRegister,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerCompanySchema),
    defaultValues: {
      companyName: "",
      companySlug: "",
      companyAddress: "",
      city: "",
      companyPhone: "",
    },
    mode: "onBlur",
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      const res = await createOrganization(data.companyName, data.companySlug);
      if (res.success) {
        toast.success(res.message);
        router.push("/dashboard");
        return;
      }

      toast.error(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };
  return (
    <div className="flex px-4">
      <Card className="w-full shadow-none rounded-2xl border-none">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-center">
            Register Your Company
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Your Company Name"
                autoComplete="organization"
                {...formRegister("companyName")}
              />
              {errors.companyName && (
                <p className="text-sm text-red-500">
                  {errors.companyName.message}
                </p>
              )}
            </div>
           
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input
                id="subdomain"
                placeholder="Your Company Subdomain"
                autoComplete="organization"
                {...formRegister("companySlug")}
              />
              {errors.companySlug && (
                <p className="text-sm text-red-500">
                  {errors.companySlug.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyPhone">Company Phone</Label>
              <Input
                id="companyPhone"
                type="tel"
                placeholder="+92XXXXXXXXXX"
                autoComplete="tel"
                {...formRegister("companyPhone")}
              />
              {errors.companyPhone && (
                <p className="text-sm text-red-500">
                  {errors.companyPhone.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyAddress">Company Address</Label>
              <Input
                id="companyAddress"
                placeholder="Street, City, Country"
                autoComplete="street-address"
                {...formRegister("companyAddress")}
              />
              {errors.companyAddress && (
                <p className="text-sm text-red-500">
                  {errors.companyAddress.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="City"
                autoComplete="address-level2"
                {...formRegister("city")}
              />
              {errors.city && (
                <p className="text-sm text-red-500">{errors.city.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Sign Up"}
            </Button>
          </form>
          
          <p>
            Have an account?{" "}
            <a href="/login" className=" underline">
              Login
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
