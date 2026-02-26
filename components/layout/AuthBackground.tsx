"use client";

export function AuthBackground(): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Orb 1 — Large, top-right */}
      <div
        className="auth-orb absolute -top-10 right-[-5%] h-[400px] w-[400px] rounded-full blur-[60px] sm:h-[550px] sm:w-[550px]"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.8), rgba(126,34,206,0.4) 60%, transparent 80%)",
          animation: "orb1 10s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />

      {/* Orb 2 — Medium, bottom-left */}
      <div
        className="auth-orb absolute bottom-[-5%] left-[-8%] h-[350px] w-[350px] rounded-full blur-[50px] sm:h-[480px] sm:w-[480px]"
        style={{
          background:
            "radial-gradient(circle, rgba(192,132,252,0.7), rgba(147,51,234,0.35) 60%, transparent 80%)",
          animation: "orb2 13s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />

      {/* Orb 3 — Small, accent, drifts across center */}
      <div
        className="auth-orb absolute top-[40%] left-[10%] h-[250px] w-[250px] rounded-full blur-[50px] sm:h-[350px] sm:w-[350px]"
        style={{
          background:
            "radial-gradient(circle, rgba(216,180,254,0.6), rgba(168,85,247,0.25) 60%, transparent 80%)",
          animation: "orb3 8s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}
