import { useEffect, useRef } from "react";
import { createStudio } from "./app";

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    let cleanup: (() => void) | null = null;
    let alive = true;
    createStudio(ref.current).then((c) => {
      if (alive) cleanup = c;
      else c();
    });
    return () => {
      alive = false;
      cleanup?.();
    };
  }, []);
  return <div ref={ref} style={{ height: "100%" }} />;
}
