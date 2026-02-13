import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TrialBadge } from "@/components/member/TrialBadge";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";

export const metadata = {
  title: "Trial Members - Wonder Woman Fitness",
};

export default async function TrialMembersPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const trialMembers = await prisma.user.findMany({
    where: { role: "MEMBER", status: "TRIAL" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      joinDate: true,
      trialEndsAt: true,
    },
    orderBy: { trialEndsAt: "asc" },
  });

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">
            Trial Members
          </h1>
          <p className="mt-1 text-sm text-surface-400">
            {trialMembers.length} member{trialMembers.length !== 1 ? "s" : ""}{" "}
            on trial
          </p>
        </div>
        <Link href="/members">
          <Button variant="ghost" size="sm">
            ← Back to Members
          </Button>
        </Link>
      </div>

      {/* List */}
      {trialMembers.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-surface-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
            </svg>
            <p className="text-sm text-surface-500">
              No trial members at the moment
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-surface-700">
            {trialMembers.map((member) => {
              const daysLeft = member.trialEndsAt
                ? differenceInDays(new Date(member.trialEndsAt), now)
                : null;

              return (
                <Link
                  key={member.id}
                  href={`/members/${member.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-800/80"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-surface-200">
                        {member.name}
                      </p>
                      {member.trialEndsAt && (
                        <TrialBadge trialEndsAt={member.trialEndsAt} />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-surface-400">
                      {member.email}
                      {member.phone && ` · ${member.phone}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-surface-400">
                      Joined{" "}
                      {format(new Date(member.joinDate), "MMM d, yyyy")}
                    </p>
                    {member.trialEndsAt && (
                      <p
                        className={`text-xs ${
                          daysLeft !== null && daysLeft <= 3
                            ? "text-warning-400"
                            : "text-surface-500"
                        }`}
                      >
                        Trial ends{" "}
                        {format(new Date(member.trialEndsAt), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
