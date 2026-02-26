"use client";

export function AuthBackground(): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Orb 1 — Large, top-right */}
      <div
        className="auth-orb absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full opacity-45 blur-[100px] sm:h-[600px] sm:w-[600px]"
        style={{
          background:
            "radial-gradient(circle, var(--color-primary-600), var(--color-primary-800) 70%, transparent)",
          animation: "orb1 20s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />

      {/* Orb 2 — Medium, bottom-left */}
      <div
        className="auth-orb absolute -bottom-24 -left-24 h-[350px] w-[350px] rounded-full opacity-35 blur-[100px] sm:h-[450px] sm:w-[450px]"
        style={{
          background:
            "radial-gradient(circle, var(--color-primary-500), var(--color-primary-700) 70%, transparent)",
          animation: "orb2 25s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />

      {/* Orb 3 — Small, center-left accent */}
      <div
        className="auth-orb absolute top-1/3 -left-12 h-[250px] w-[250px] rounded-full opacity-30 blur-[80px] sm:h-[300px] sm:w-[300px]"
        style={{
          background:
            "radial-gradient(circle, var(--color-primary-400), var(--color-surface-900) 70%, transparent)",
          animation: "orb3 18s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}
