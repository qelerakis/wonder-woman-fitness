type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info";

type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-700 text-surface-300",
  primary: "bg-primary-900/50 text-primary-300 border border-primary-700/50",
  success: "bg-success-700/20 text-success-500 border border-success-700/30",
  warning: "bg-warning-700/20 text-warning-500 border border-warning-700/30",
  error: "bg-error-700/20 text-error-500 border border-error-700/30",
  info: "bg-primary-700/20 text-primary-300 border border-primary-700/30",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export function Badge({
  variant = "default",
  size = "sm",
  children,
  className = "",
}: BadgeProps): React.ReactElement {
  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `.trim()}
    >
      {children}
    </span>
  );
}

export type { BadgeProps, BadgeVariant, BadgeSize };
