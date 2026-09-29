
import { getCurrentUserSession } from "@/actions/session";
import ChangePasswordForm from "@/components/auth/ResetPassword";
import ProfileCard from "@/components/profile";

export default async function ProfilePage() {
  const session = await getCurrentUserSession();
  const user = session?.user;
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600 mt-2">
            Manage your profile and account preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {user && <ProfileCard user={user} />}
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
