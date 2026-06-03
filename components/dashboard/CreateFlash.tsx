"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

export function CreateFlash({
  created,
  message,
}: {
  created?: string;
  message: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!created) return;
    toast.success(message);
    router.replace(pathname);
  }, [created, message, pathname, router]);

  return null;
}
