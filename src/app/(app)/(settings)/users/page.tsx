
import { getOrganizationUser } from "@/actions/user";
import { UserDialog } from "@/components/UserDialog";
import UsersTable from "@/components/usersTable";


export default async function UserPage() {
  const users = await getOrganizationUser();
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
        <UserDialog />
      </div>
      <UsersTable users={users} />
    </div>
  );
}
