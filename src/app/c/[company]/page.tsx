import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const subdomainData = await prisma.organization.findFirst({
    where: {
      slug: company,
    },
  });

  const data = await auth.api.getActiveMember({
    headers: await headers(),
  });

  if (!subdomainData) {
    notFound();
  }

  return (
    <div className="h-screen w-full justify-between items-center flex flex-col gap-4">
      {subdomainData.name}
      <h1>Go To Dashboard</h1>
    </div>
  );
}
