import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { format } from "date-fns";

export const metadata = {
  title: "Inactive Members - Wonder Woman Fitness",
};

export default async function InactiveMembersPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const departedMembers = await prisma.user.findMany({
    where: { role: "MEMBER", status: "DEPARTED" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      joinDate: true,
      departedAt: true,
      departReason: true,
    },
    orderBy: { departedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">
            Inactive Members
          </h1>
          <p className="mt-1 text-sm text-surface-400">
            {departedMembers.length} departed member
            {departedMembers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/members">
          <Button variant="ghost" size="sm">
            ← Back to Members
          </Button>
        </Link>
      </div>

      {/* List */}
      {departedMembers.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-surface-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <p className="text-sm text-surface-500">
              No departed members
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-surface-700">
            {departedMembers.map((member) => (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-800/80"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-surface-200">
                      {member.name}
                    </p>
                    <Badge variant="default" size="sm">
                      Departed
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-surface-400">
                    {member.email}
                    {member.phone && ` · ${member.phone}`}
                  </p>
                  {member.departReason && (
                    <p className="mt-1 text-xs text-surface-500 line-clamp-2">
                      Reason: {member.departReason}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-surface-400">
                    Joined{" "}
                    {format(new Date(member.joinDate), "MMM d, yyyy")}
                  </p>
                  {member.departedAt && (
                    <p className="text-xs text-surface-500">
                      Left{" "}
                      {format(new Date(member.departedAt), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
