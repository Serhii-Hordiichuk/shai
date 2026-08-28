import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import langJs from "highlight.js/lib/languages/javascript";
import langTs from "highlight.js/lib/languages/typescript";
import langPy from "highlight.js/lib/languages/python";
import langJson from "highlight.js/lib/languages/json";
import langBash from "highlight.js/lib/languages/bash";
import langCss from "highlight.js/lib/languages/css";
import langXml from "highlight.js/lib/languages/xml";
import langSql from "highlight.js/lib/languages/sql";
import langYaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("javascript", langJs);
hljs.registerLanguage("js", langJs);
hljs.registerLanguage("typescript", langTs);
hljs.registerLanguage("ts", langTs);
hljs.registerLanguage("python", langPy);
hljs.registerLanguage("py", langPy);
hljs.registerLanguage("json", langJson);
hljs.registerLanguage("bash", langBash);
hljs.registerLanguage("shell", langBash);
hljs.registerLanguage("sh", langBash);
hljs.registerLanguage("css", langCss);
hljs.registerLanguage("html", langXml);
hljs.registerLanguage("xml", langXml);
hljs.registerLanguage("sql", langSql);
hljs.registerLanguage("yaml", langYaml);
hljs.registerLanguage("yml", langYaml);

export interface Artifact {
  id: string;
  lang: string;
  title: string;
  code: string;
  ts: number;
}

const ART_LANGS = new Set(["html", "js", "javascript", "ts", "typescript", "python", "py", "css", "json", "bash", "sql"]);

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function highlight(code: string, lang: string): string {
  const l = lang?.toLowerCase();
  if (l && hljs.getLanguage(l)) {
    try { return hljs.highlight(code, { language: l }).value; } catch { /* fallthrough */ }
  }
  return escapeHtml(code);
}

export function extractArtifacts(md: string, ts = Date.now()): Artifact[] {
  const out: Artifact[] = [];
  const re = /```(\w+)?[^\n]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const lang = (m[1] || "").toLowerCase();
    const code = m[2].trim();
    if (!ART_LANGS.has(lang) || code.length < 40) continue;
    out.push({
      id: hashStr(lang + ":" + code),
      lang,
      title: lang === "html" ? "HTML page" : `${lang.toUpperCase()} snippet`,
      code,
      ts,
    });
  }
  return out;
}

function codeBlockHtml(lang: string, code: string): string {
  const l = lang?.toLowerCase() || "text";
  const lines = code.split("\n");
  const nums = lines.map((_, i) => i + 1).join("\n");
  const isArtifact = ART_LANGS.has(l) && code.length >= 40;
  const id = isArtifact ? hashStr(l + ":" + code.trim()) : "";
  return [
    `<div class="codeblock${isArtifact ? " is-artifact" : ""}" data-artifact-id="${id}">`,
    `<div class="cb-head"><span class="cb-lang">${escapeHtml(l)}</span>`,
    `<span class="cb-lines">${lines.length} ${lines.length === 1 ? "line" : "lines"}</span>`,
    isArtifact ? `<button class="cb-open" title="Open in the artifacts panel">art</button>` : "",
    `<button class="cb-copy" title="Copy code">copy</button></div>`,
    `<div class="cb-body"><div class="cb-num" aria-hidden="true">${nums}</div><pre><code>${highlight(code, l)}</code></pre></div>`,
    `</div>`,
  ].join("");
}

const renderer = new marked.Renderer();
(renderer as any).code = function (this: unknown, arg: unknown) {
  const text = typeof arg === "string" ? arg : ((arg as any)?.text ?? "");
  const lang = typeof arg === "object" ? ((arg as any)?.lang ?? "") : "";
  return codeBlockHtml(String(lang || ""), String(text || "").replace(/\n$/, ""));
};

marked.setOptions({ renderer, breaks: true, gfm: true });

export function renderMarkdown(md: string): string {
  try {
    return marked.parse(md, { async: false }) as string;
  } catch {
    return `<p>${escapeHtml(md)}</p>`;
  }
}
