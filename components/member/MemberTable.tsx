"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { TrialBadge } from "./TrialBadge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import type { PaymentStatus } from "@/lib/constants";
import { format } from "date-fns";

interface MemberTableData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo: string | null;
  status: string;
  joinDate: Date | string;
  trialEndsAt: Date | string | null;
  paymentStatus: PaymentStatus;
}

interface MemberTableProps {
  members: MemberTableData[];
  basePath?: string;
}

const statusFilterOptions = [
  { value: "all", label: "All Statuses" },
  { value: "PAID", label: "Paid" },
  { value: "TRIAL", label: "Trial" },
  { value: "GRACE_PERIOD", label: "Grace Period" },
  { value: "LOCKED", label: "Locked" },
  { value: "OVERRIDE", label: "Override" },
  { value: "DEPARTED", label: "Departed" },
];

export function MemberTable({
  members,
  basePath = "/members",
}: MemberTableProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        search === "" ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || m.paymentStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [members, search, statusFilter]);

  return (
    <Card padding="none">
      {/* Filters */}
      <div className="flex flex-col gap-3 border-b border-surface-700 px-4 py-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={statusFilterOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700 text-left">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                Member
              </th>
              <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 sm:table-cell">
                Email
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                Status
              </th>
              <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 md:table-cell">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700/50">
            {filtered.map((member) => (
              <tr
                key={member.id}
                className="transition-colors hover:bg-surface-800/80"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`${basePath}/${member.id}`}
                    className="flex items-center gap-3"
                  >
                    {member.photo ? (
                      <Image
                        src={member.photo}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-surface-200 hover:text-primary-300">
                      {member.name}
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-sm text-surface-400 sm:table-cell">
                  {member.email}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <PaymentStatusBadge status={member.paymentStatus} />
                    {member.status === "TRIAL" && member.trialEndsAt && (
                      <TrialBadge trialEndsAt={member.trialEndsAt} />
                    )}
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-sm text-surface-500 md:table-cell">
                  {format(new Date(member.joinDate), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-surface-500">
            {members.length === 0
              ? "No members yet"
              : "No members match your filters"}
          </p>
        </div>
      )}

      {/* Count */}
      <div className="border-t border-surface-700 px-4 py-2">
        <p className="text-xs text-surface-500">
          Showing {filtered.length} of {members.length} member{members.length === 1 ? "" : "s"}
        </p>
      </div>
    </Card>
  );
}

export type { MemberTableProps, MemberTableData };
