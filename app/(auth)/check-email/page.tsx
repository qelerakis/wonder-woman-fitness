import { Suspense } from "react";
import CheckEmailClient from "./CheckEmailClient";

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div className="text-center text-surface-400">Loading...</div>}>
      <CheckEmailClient />
    </Suspense>
  );
}
