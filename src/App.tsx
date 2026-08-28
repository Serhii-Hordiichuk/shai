import { useEffect, useRef } from "react";
import { createStudio } from "./app";

/* Тонка обгортка-бутстрап: увесь застосунок — чистий Vanilla JS (src/app.ts) */
export default function App() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    if (ref.current) {
      createStudio(ref.current).then((c) => {
        if (cancelled) c();
        else cleanup = c;
      });
    }
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <div ref={ref} className="app-root" />;
}
