"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeDateWaitlistEntryAdminAction, removeWaitlistEntryAction } from "@/lib/actions/waitlist";

export function RemoveWaitlistEntryButton({ id, kind = "general" }: { id: string; kind?: "general" | "date" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    await (kind === "date" ? removeDateWaitlistEntryAdminAction(id) : removeWaitlistEntryAction(id));
    setPending(false);
    router.refresh();
  }

  return (
    <button onClick={remove} disabled={pending} className="text-sm text-red-600 underline disabled:opacity-50">
      {pending ? "מסיר..." : "הסרה מהרשימה"}
    </button>
  );
}
