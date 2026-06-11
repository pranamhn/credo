"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PageProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setVisible(true);
    setWidth(18);

    const grow = window.setTimeout(() => setWidth(72), 20);
    const finish = window.setTimeout(() => setWidth(100), 180);
    const hide = window.setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 360);

    return () => {
      window.clearTimeout(grow);
      window.clearTimeout(finish);
      window.clearTimeout(hide);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed left-0 top-0 z-[60] h-0.5 w-full bg-transparent">
      <div
        className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 shadow-[0_0_12px_rgba(124,58,237,0.45)] transition-all duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
