interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  children,
  className = "",
  padding = "md",
}: CardProps): React.ReactElement {
  return (
    <div
      className={`
        rounded-xl border border-surface-700 bg-surface-800
        ${paddingClasses[padding]}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function CardHeader({
  title,
  description,
  action,
}: CardHeaderProps): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-surface-100">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-surface-400">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export type { CardProps, CardHeaderProps };
