import { useEffect, useRef } from "react";
import { mountChat } from "./chat";

/* Тонка обгортка: сам застосунок — чистий vanilla JS (src/chat.ts) */
export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const cleanup = mountChat(rootRef.current);
    return cleanup;
  }, []);

  return <div ref={rootRef} style={{ height: "100%" }} />;
}
