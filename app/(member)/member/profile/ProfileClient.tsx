"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo: string | null;
  status: string;
  joinDate: string;
  trialEndsAt: string | null;
}

interface ProfileClientProps {
  user: UserData;
}

export function ProfileClient({
  user,
}: ProfileClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();

  // Profile form state
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<
    Record<string, string>
  >({});

  async function handleSaveProfile(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = "Name is required";
    if (!email.trim()) errors.email = "Email is required";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Invalid email format";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/members/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: "Profile updated" });
        router.refresh();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: "Failed to update",
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!currentPassword) errors.currentPassword = "Current password required";
    if (!newPassword) errors.newPassword = "New password required";
    if (newPassword.length < 8) {
      errors.newPassword = "Password must be at least 8 characters";
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: "Password changed" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordErrors({});
      } else {
        const data: { error: string } = await res.json();
        setPasswordErrors({ form: data.error });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-100">My Profile</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile Info */}
        <Card>
          <CardHeader title="Profile Information" />
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              {user.photo ? (
                <Image
                  src={user.photo}
                  alt={user.name}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-700 text-xl font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm text-surface-300">
                  Member since{" "}
                  {format(new Date(user.joinDate), "MMMM yyyy")}
                </p>
                <Badge
                  variant={
                    user.status === "ACTIVE"
                      ? "success"
                      : user.status === "TRIAL"
                        ? "info"
                        : "default"
                  }
                  size="sm"
                >
                  {user.status === "TRIAL" ? "New Member" : user.status}
                </Badge>
              </div>
            </div>

            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={formErrors.name}
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={formErrors.email}
            />

            <Input
              label="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+389..."
            />

            <div className="pt-2">
              <Button type="submit" variant="primary" loading={saving}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>

        {/* Change Password */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Change Password" />
            <form
              onSubmit={handleChangePassword}
              className="mt-4 space-y-4"
            >
              <Input
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                error={passwordErrors.currentPassword}
              />

              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={passwordErrors.newPassword}
                helpText="At least 8 characters"
              />

              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={passwordErrors.confirmPassword}
              />

              {passwordErrors.form && (
                <p className="text-sm text-error-500" role="alert">
                  {passwordErrors.form}
                </p>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="secondary"
                  loading={changingPassword}
                >
                  Change Password
                </Button>
              </div>
            </form>
          </Card>

          {/* Danger Zone */}
          <Card>
            <CardHeader
              title="Danger Zone"
              description="Irreversible actions"
            />
            <div className="mt-4">
              <Link href="/member/stop-training">
                <Button variant="danger" size="sm">
                  Stop Training
                </Button>
              </Link>
              <p className="mt-2 text-xs text-surface-500">
                This will mark your account as departed. You can request to
                rejoin later.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
