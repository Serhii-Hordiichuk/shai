import { useEffect, useRef } from "react";
import { initChat } from "./chat";

/*
  React тут — лише точка монтування.
  Увесь чат-бот живе у src/chat.ts на чистому JS:
  DOM, події, стан і анімації — без жодного фреймворка.
*/
export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const destroy = initChat(rootRef.current);
    return destroy;
  }, []);

  return <div ref={rootRef} className="app-root" style={{ height: "100%" }} />;
}
