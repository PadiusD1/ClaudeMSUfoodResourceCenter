import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  ClockIcon,
  EyeIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  PackageIcon,
  CheckCheckIcon,
  XCircleIcon,
  TimerIcon,
  UserXIcon,
  BanIcon,
} from "lucide-react";

export type RequestStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "partially_approved"
  | "ready_for_pickup"
  | "completed"
  | "denied"
  | "expired"
  | "no_show"
  | "cancelled";

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    icon: ClockIcon,
  },
  under_review: {
    label: "Under Review",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    icon: EyeIcon,
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircleIcon,
  },
  partially_approved: {
    label: "Partially Approved",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: AlertCircleIcon,
  },
  ready_for_pickup: {
    label: "Ready for Pickup",
    className: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: PackageIcon,
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: CheckCheckIcon,
  },
  denied: {
    label: "Denied",
    className: "bg-red-100 text-red-800 border-red-200",
    icon: XCircleIcon,
  },
  expired: {
    label: "Expired",
    className: "bg-gray-100 text-gray-800 border-gray-200",
    icon: TimerIcon,
  },
  no_show: {
    label: "No-Show",
    className: "bg-orange-100 text-orange-800 border-orange-200",
    icon: UserXIcon,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-100 text-slate-800 border-slate-200",
    icon: BanIcon,
  },
};

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: RequestStatus;
  size?: "sm" | "lg";
}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;
  const sizeClass =
    size === "lg" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5";

  return (
    <Badge
      variant="outline"
      className={`${config.className} ${sizeClass} font-medium gap-1 inline-flex items-center`}
    >
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
      {config.label}
    </Badge>
  );
}
