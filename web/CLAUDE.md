# Frontend conventions — Swish Support Copilot (`web/`)

A small client-only SPA (no SSR, no router framework). Surfaces: Swish-branded support **chat UI**, a WhatsApp-style **simulator**, a shared-**inbox/escalation** view, and a **play arena** to create test profiles/orders. It calls a Hono JSON API and renders **streamed** assistant replies.

**Stack (exact):** React 19.2 · Vite 8.1 (`@vitejs/plugin-react` 6) · Tailwind CSS v4.3 via `@tailwindcss/vite` (CSS-first, no `tailwind.config.js`) · TypeScript 6 · ESM. Entry: `web/src/main.tsx`; Vite `root` is `web/` (see `vite.config.ts`). Dev proxy: `/api` → `http://localhost:8787` (Hono).

These are project-specific, version-specific rules. Read them before generating code; they override habits from React 18 / Tailwind v3 / Vite ≤7.

---

## React 19 idioms (these REPLACE the React 18 way)

- **`ref` is a plain prop. Never write `forwardRef` in new code.** Function components accept `ref` directly. `forwardRef` is documented as no longer necessary and slated for deprecation/removal. ([react.dev/reference/react/forwardRef](https://react.dev/reference/react/forwardRef), [react.dev/blog/2024/12/05/react-19](https://react.dev/blog/2024/12/05/react-19))
  ```tsx
  function MessageInput({ ref }: { ref?: React.Ref<HTMLTextAreaElement> }) {
    return <textarea ref={ref} />;
  }
  ```
- **`useRef` now REQUIRES an argument** in React 19 types; `useRef()` is a type error. Use `useRef<HTMLDivElement>(null)`. All refs are mutable now — `MutableRefObject` is deprecated; everything is `RefObject<T>`. ([react.dev/blog/2024/04/25/react-19-upgrade-guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide))
- **Ref callbacks must use a block body** if they assign — returning a non-cleanup value is a type error: `ref={el => { listRef.current = el; }}` (not `ref={el => (listRef.current = el)}`).
- **`use()` for reading promises/context.** `use()` can be called **conditionally, in loops, after early returns** (unlike hooks). Reading a promise suspends (needs a `<Suspense>` boundary); rejection hits the nearest Error Boundary. **Constraint:** the promise must be created **outside render** (event handler / module-level cache) — do NOT `use(fetch(...))` inline in render. ([react.dev/reference/react/use](https://react.dev/reference/react/use))
- **Actions + `useActionState` for mutations/sends.** Signature: `const [state, formAction, isPending] = useActionState(fn, initialState)` where `fn(prevState, formData)` returns the next state. Wire to `<form action={formAction}>`; React auto-manages pending/error state and **resets the form on success**. Prefer this over a manual `onSubmit` + `useState` loading flag for the message composer. ([react.dev/reference/react/useActionState](https://react.dev/reference/react/useActionState))
- **`useOptimistic` for the outgoing user bubble** (instant echo before the server confirms). `const [optimisticMsgs, addOptimistic] = useOptimistic(messages, (cur, text) => [...cur, {id:'temp', role:'user', text, pending:true}])`. Must be dispatched **inside an Action** (form action / transition); React auto-reverts if the action errors. ([react.dev/reference/react/useOptimistic](https://react.dev/reference/react/useOptimistic))
  - **Do NOT use `useOptimistic` for the streamed assistant reply.** Optimistic state only covers the pending-action window. Stream assistant tokens into ordinary `useState` (append chunks as they arrive). See "Streamed assistant text" below.
- **`useTransition` supports async Actions** in 19: `const [isPending, startTransition] = useTransition()`, and `startTransition(async () => {...})`. **Gotcha:** any `setState` **after an `await`** must be re-wrapped in `startTransition` to stay part of the transition (documented limitation). ([react.dev/reference/react/useTransition](https://react.dev/reference/react/useTransition))
- **Document metadata via native tags** — `<title>`, `<meta>`, `<link>` rendered anywhere hoist into `<head>` automatically, works in client-only apps. **Do not add `react-helmet`** for our needs (per-view title/description). ([react.dev/blog/2024/12/05/react-19](https://react.dev/blog/2024/12/05/react-19))
- **`useEffectEvent` (stable in 19.2)** for non-reactive logic inside Effects (e.g. read latest `theme`/`socket` in a ws/stream Effect without re-subscribing). The Effect Event **must not** go in the dependency array. ([react.dev/reference/react/useEffectEvent](https://react.dev/reference/react/useEffectEvent))
- **`<Activity>` (stable in 19.2)** for keep-alive view switching — use `<Activity mode={active ? 'visible' : 'hidden'}>` to preserve state of an inactive panel (e.g. switching between Chat / Inbox / Play Arena) instead of unmounting. Hidden subtrees keep state but unmount Effects and defer updates. ([react.dev/reference/react/Activity](https://react.dev/reference/react/Activity))
- **Experimental — do NOT use:** `<ViewTransition>` is still experimental (`react@experimental`) in 19.2, not stable. `cacheSignal`, `resume()`/prerender APIs are SSR/RSC-only — irrelevant to this client SPA. ([react.dev/blog/2025/10/01/react-19-2](https://react.dev/blog/2025/10/01/react-19-2))

### React Compiler — ENABLED; do not hand-memoize new code

- **The React Compiler is STABLE (1.0, GA Oct 2025)** and we target it. It auto-memoizes; it can memoize cases `useMemo`/`useCallback` cannot (e.g. after an early return). ([react.dev/blog/2025/10/07/react-compiler-1](https://react.dev/blog/2025/10/07/react-compiler-1), [react.dev/learn/react-compiler](https://react.dev/learn/react-compiler))
- **Rule for NEW code: do NOT write `useMemo` / `useCallback` / `React.memo` by default.** Official guidance: "For new code, we recommend relying on the compiler for memoization and using `useMemo`/`useCallback` where needed to achieve precise control." Treat manual memo as a deliberate escape hatch (a measured perf fix), not a reflex. ([react.dev/blog/2025/10/07/react-compiler-1](https://react.dev/blog/2025/10/07/react-compiler-1))
- **For existing memoized code:** leave it; removing it can change compiler output. The compiler preserves hand-written memo (`preserve-manual-memoization` rule) rather than stripping it. ([react.dev/blog/2025/10/07/react-compiler-1](https://react.dev/blog/2025/10/07/react-compiler-1))
- **Enable it in `vite.config.ts`** — plugin-react 6 dropped inline Babel, so the compiler is an explicit Babel pass. Install `-D @rolldown/plugin-babel @babel/core babel-plugin-react-compiler`, then:
  ```ts
  import react, { reactCompilerPreset } from '@vitejs/plugin-react';
  import babel from '@rolldown/plugin-babel';
  export default defineConfig({
    root: 'web',
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  });
  ```
  `target` defaults to `'19'` — do not set it. ([react.dev/learn/react-compiler/installation](https://react.dev/learn/react-compiler/installation), [github.com/vitejs/vite-plugin-react/releases/tag/plugin-react@6.0.0](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react@6.0.0))
- **Lint enforces the Rules of React** (the compiler depends on them): use `eslint-plugin-react-hooks@latest` (v6+, rules ship in `recommended`). Remove standalone `eslint-plugin-react-compiler` — it's folded into the hooks plugin. ([react.dev/blog/2025/10/07/react-compiler-1](https://react.dev/blog/2025/10/07/react-compiler-1))
- **Escape hatch / debugging:** add the `"use no memo"` directive at the top of a function to skip compilation for it (debugging only). Verify a component compiled via the **"✨" badge** in React DevTools. ([react.dev/learn/react-compiler/debugging](https://react.dev/learn/react-compiler/debugging))

---

## Chat UI component patterns

- **No virtualization at our scale.** A support conversation is tens-to-low-hundreds of messages; render the whole list. Reach for a windowing lib only if a single view actually exceeds ~hundreds of nodes with measured jank.
- **Stable keys = server message id.** Never use array index. The optimistic echo uses a temp id (e.g. `temp-${nanoid()}`); when the server record arrives, reconcile by replacing the temp entry — keep the key stable across that swap if possible, or accept one keyed remount.
- **Avoid re-render storms while streaming.** Streaming appends fire many state updates per second. Isolate the streaming text in a **small leaf component** subscribed only to the in-flight message, so each token chunk re-renders one bubble, not the whole list/composer. Keep the composer (controlled input) in its own component so keystrokes don't re-render the message list and vice-versa.
- **Controlled input** for the composer: `value` + `onChange` with inferred event type (`onChange={e => setText(e.currentTarget.value)}`). Submit via `<form action={sendAction}>` (useActionState) so Enter/submit/pending/reset are handled.
- **Streamed assistant text:** read the `fetch` `Response.body` as a stream (`for await (const chunk of res.body.pipeThrough(new TextDecoderStream()))`), appending decoded chunks to the active assistant message in `useState`. Batch is automatic in React 19, but for very high token rates coalesce chunks with a microtask/`requestAnimationFrame` buffer if profiling shows jank. Carry an `AbortController` so navigating away / sending a new message cancels the stream.
- **Autoscroll done right:** before each append, check if the user is near the bottom (`scrollHeight - scrollTop - clientHeight < threshold`). Only auto-scroll when they were already at the bottom; otherwise show a "jump to latest" affordance. Do the scroll in a layout effect after the DOM updates. Don't fight the user's manual scroll-up.
- **Trace/debug panel without thrashing:** keep trace events in a `useReducer` log **separate** from chat state, render the panel in its own subtree (ideally behind `<Activity>` when hidden so it isn't doing work), and append in batches. Never thread trace state through the chat components' props.

---

## State management

- **Default to `useState` / `useReducer` + Context. Do NOT add Redux** (or any global store) for this app size. Use `useReducer` for the chat/inbox state machines (idle → sending → streaming → done/error); use Context only to pass stable, rarely-changing values (current user/session, API base, theme).
- **Split contexts by update frequency** to avoid broad re-renders: a fast-changing value and a stable value should not share one provider.
- **Data fetching: a custom hook + `fetch` + `AbortController`** is the standard here — no React Query / SWR for this scope. Pattern: abort the previous request on re-fetch/unmount, track `{data, error, status}`, and for the chat use the streaming reader described above (not a one-shot fetch).
  ```ts
  function useJson<T>(url: string) {
    const [state, setState] = useState<{status:'idle'|'loading'|'error'|'ok'; data?:T; error?:unknown}>({status:'idle'});
    useEffect(() => {
      const ac = new AbortController();
      setState({status:'loading'});
      fetch(url, { signal: ac.signal })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => setState({status:'ok', data}))
        .catch(error => { if (!ac.signal.aborted) setState({status:'error', error}); });
      return () => ac.abort();
    }, [url]);
    return state;
  }
  ```
- Only consider a tiny external store (e.g. Zustand) if cross-tree shared state genuinely emerges (e.g. inbox selection shared across distant panels) and Context causes measurable re-render pain. Document the reason if you add one.

---

## Vite 8

- **Config lives in root `vite.config.ts`** with `root: 'web'`. Plugins: `react()` then `tailwindcss()` (and the Babel/compiler pass if added — order: `react()`, `babel(...)`, `tailwindcss()`).
- **Vite 8 uses Rolldown (Rust) as the single default bundler** (replaces esbuild+Rollup; Oxc does JS transforms/minify). Practical effects: `build.rollupOptions` → **`build.rolldownOptions`** (old name is a deprecated alias); `manualChunks` **object form removed** (function form deprecated) — prefer automatic splitting. ([vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8), [vite.dev/guide/migration](https://vite.dev/guide/migration))
- **Env vars:** only `VITE_`-prefixed vars reach the client via `import.meta.env`. **Never prefix a secret with `VITE_`** — keep API keys server-side in the Hono app. Built-ins: `import.meta.env.MODE | DEV | PROD | BASE_URL`. `.env` load order (later wins): `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`; gitignore `*.local`. ([vite.dev/guide/env-and-mode](https://vite.dev/guide/env-and-mode))
  - **Type env vars** by augmenting `ImportMetaEnv` in `web/src/vite-env.d.ts` (which already has `/// <reference types="vite/client" />`):
    ```ts
    /// <reference types="vite/client" />
    interface ImportMetaEnv { readonly VITE_API_URL?: string }
    ```
- **Dev proxy is set** (`/api` → `http://localhost:8787`). Call the API with relative paths (`fetch('/api/...')`) so dev proxy and prod same-origin both work. Add `ws: true` / `rewrite` to the proxy entry only if needed (Hono is at `/api` already, so no rewrite). ([vite.dev/config/server-options](https://vite.dev/config/server-options))
- **Code splitting:** lazy-load the heavier non-chat surfaces (WhatsApp sim, Play Arena, trace panel) with `React.lazy(() => import('./PlayArena'))` + `<Suspense>`. Dynamic `import()` becomes its own chunk automatically; Vite parallelizes shared chunks. ([vite.dev/guide/features](https://vite.dev/guide/features))
- **Assets:** default import = hashed URL string; suffixes `?url` / `?raw` / `?inline` / `?no-inline`; `public/` is served at `/` and copied unhashed (reference as `/logo.svg`, don't `import` from it); SVG imports give a URL (use `?raw` for markup, or add svgr for SVG-as-component). Inline threshold `build.assetsInlineLimit` = 4 KiB. ([vite.dev/guide/assets](https://vite.dev/guide/assets))

---

## Tailwind CSS v4.3 (CSS-first — NO `tailwind.config.js`)

- **Setup is already correct:** `@tailwindcss/vite` plugin + a single `@import "tailwindcss";` in `web/src/index.css`. **Do not create `tailwind.config.js`** and do not add `@tailwind base/components/utilities` (that's v3). JS config is not auto-detected; only opt in via `@config "..."` if ever genuinely needed. ([tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4), [tailwindcss.com/docs/upgrade-guide](https://tailwindcss.com/docs/upgrade-guide))
- **Define brand design tokens in CSS with `@theme`** — tokens auto-generate utilities AND are exposed as `:root` CSS variables. This is how we get a consistent Swish-branded UI:
  ```css
  @import "tailwindcss";
  @theme {
    --color-brand-500: oklch(0.62 0.19 260);   /* → bg-brand-500, text-brand-500, border-brand-500 ... */
    --color-brand-600: oklch(0.55 0.19 260);
    --font-sans: "Inter", system-ui, sans-serif; /* → font-sans */
    --radius-bubble: 1rem;                        /* → rounded-[var(--radius-bubble)] or custom utility */
  }
  ```
  Namespaces that generate utilities: `--color-*`, `--font-*`, `--text-*` (sizes), `--font-weight-*`, `--tracking-*`, `--leading-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--breakpoint-*`, `--container-*`, `--animate-*`, `--ease-*`. ([tailwindcss.com/docs/theme](https://tailwindcss.com/docs/theme))
  - Use **`@theme inline`** when a token's value references another `var()` (e.g. a framework-injected font var) so the value is embedded in the utility and doesn't resolve at the wrong cascade level.
  - Reference tokens in custom CSS / arbitrary values as `var(--color-brand-500)`. Prefer CSS vars over the deprecated `theme()` function.
  - Put values you do NOT want turned into utilities under `:root`, not `@theme`.
- **Dark mode changed:** the `darkMode` config option is gone (no config file). Default `dark:` still follows `prefers-color-scheme`. For a class/attribute toggle, declare it in CSS:
  ```css
  @custom-variant dark (&:where(.dark, .dark *));   /* then toggle .dark on <html> */
  ```
  ([tailwindcss.com/docs/dark-mode](https://tailwindcss.com/docs/dark-mode))
- **Custom utilities use `@utility`** (replaces v3 `@layer utilities`; this form correctly supports variants like `hover:`/`lg:`):
  ```css
  @utility scrollbar-none { &::-webkit-scrollbar { display: none } }
  ```
  Custom variants use `@custom-variant`; apply an existing variant inside CSS with `@variant`. ([tailwindcss.com/docs/functions-and-directives](https://tailwindcss.com/docs/functions-and-directives))
- **Container queries are built-in** (no plugin): mark a wrapper `@container`, then use `@sm:` / `@md:` / `@lg:` on children (also `@max-*` and ranges). Good for inbox/chat panels that resize independently of the viewport. ([tailwindcss.com/docs/responsive-design](https://tailwindcss.com/docs/responsive-design))
- **Avoid class bloat by extracting a React component — NOT `@apply`.** Official guidance: don't use `@apply` just to make markup look cleaner; create a component (e.g. `<ChatBubble>`, `<Pill>`) and pass props/variants. `@apply` is legitimate only for styling third-party / un-controllable HTML. ([tailwindcss.com/docs/styling-with-utility-classes](https://tailwindcss.com/docs/styling-with-utility-classes))
  - **v4 gotcha:** `@apply` (and `@variant`) inside a separate CSS file / CSS module / scoped `<style>` does NOT see your theme by default — you must add `@reference "../index.css";` first (or just use `var(--...)` directly, which needs no `@reference`).
- **v4 changes that bite (the agent must use new names):** arbitrary CSS-var syntax is **parentheses**: `bg-(--brand)` (v3 was `bg-[--brand]`). Renames: `shadow-sm`→`shadow-xs` (bare `shadow`→`shadow-sm`), `rounded-sm`→`rounded-xs`, `outline-none`→`outline-hidden`, `bg-gradient-*`→`bg-linear-*`, bare `ring`→`ring-3`. Removed: `*-opacity-*` (use `bg-black/50`), `flex-shrink-*`→`shrink-*`, `flex-grow-*`→`grow-*`. **Default border & ring color is now `currentColor`** — always pair with an explicit color (`border border-gray-200`, `ring-2 ring-brand-500`). Requires Safari 16.4+/Chrome 111+/Firefox 128+. ([tailwindcss.com/docs/upgrade-guide](https://tailwindcss.com/docs/upgrade-guide))

---

## TypeScript + React

- **Type props as a plain function with a typed props object. Do NOT use `React.FC`.** It's no longer broken (implicit children was fixed) but the current idiom is plain functions; `React.FC` also breaks generic-component inference. ([react.dev/learn/typescript](https://react.dev/learn/typescript))
  ```tsx
  type ChatBubbleProps = { text: string; pending?: boolean };
  function ChatBubble({ text, pending }: ChatBubbleProps) { /* … */ }
  ```
- **Type `children` explicitly** (no longer implicit in `@types/react` 19): `children: React.ReactNode`, or `PropsWithChildren<{ ... }>` to append it.
- **Prefer event-type inference**; annotate only when you extract a named handler: `(e: React.ChangeEvent<HTMLInputElement>)`, `(e: React.FormEvent<HTMLFormElement>)`. Use `e.currentTarget`. ([react.dev/learn/typescript](https://react.dev/learn/typescript))
- **Model message/role and variant props as discriminated unions** — this is the right tool for chat bubbles and channel/status variants; TS narrows on the discriminant and blocks wrong-arm field access:
  ```tsx
  type Message =
    | { role: 'user'; text: string }
    | { role: 'assistant'; text: string; streaming: boolean; trace?: TraceId }
    | { role: 'system'; level: 'info' | 'warn'; text: string };
  ```
- **`ref` props are typed `React.Ref<T>`** (see React 19 section). `useRef<HTMLDivElement>(null)` returns `RefObject<HTMLDivElement | null>`.
- **TS 6 + `verbatimModuleSyntax`/`erasableSyntaxOnly` reality:** use `import type { ... }` (or inline `import { type Foo }`) for type-only imports. **Avoid `enum` and `namespace`** — use string-literal unions or `as const` objects instead (these emit runtime code and are non-erasable). ([typescriptlang.org/tsconfig/verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html), [typescriptlang.org/tsconfig/erasableSyntaxOnly](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html))
- **tsconfig note for this repo:** one shared `tsconfig.json` covers `src` (Hono) and `web/src` with `"types": ["node"]`. That means `import.meta.env` types come from the `/// <reference types="vite/client" />` in `web/src/vite-env.d.ts` (already present) rather than from `types`. Keep that reference; don't delete it. `jsx` is `react-jsx`, so no `import React` needed per file.

---

## Common mistakes to avoid

- Writing `forwardRef` — use a `ref` prop. ([react 19](https://react.dev/blog/2024/12/05/react-19))
- Sprinkling `useMemo`/`useCallback`/`React.memo` on new code "for performance" — the compiler handles it; only add memo as a measured fix. ([react compiler](https://react.dev/blog/2025/10/07/react-compiler-1))
- `use(fetch(...))` created during render, or `use()` without a `<Suspense>`/Error Boundary. ([use](https://react.dev/reference/react/use))
- Forgetting to re-wrap `setState` after `await` inside `startTransition`. ([useTransition](https://react.dev/reference/react/useTransition))
- Using `useOptimistic` for streamed assistant tokens (it's for the pending-action window only) — stream into `useState`.
- Array-index keys on the message list; not aborting the stream/fetch on unmount or new send.
- Re-rendering the whole conversation per token — isolate the streaming bubble; keep the composer separate.
- Adding Redux / React Query for this app size; threading trace state through chat props.
- Creating `tailwind.config.js`, or using v3 `@tailwind` directives / `theme()` / `bg-[--x]` / `shadow-sm`(old)/`outline-none`/`bg-gradient-*` — use v4 CSS-first `@theme`, `var(--x)`, `bg-(--x)`, and the renamed utilities. ([tailwind v4](https://tailwindcss.com/docs/upgrade-guide))
- Using `@apply` to dedupe markup — extract a React component instead; and if `@apply` is unavoidable in a separate/module CSS file, add `@reference`. ([tailwind](https://tailwindcss.com/docs/styling-with-utility-classes))
- Prefixing a secret with `VITE_` (it gets bundled into the client). ([env](https://vite.dev/guide/env-and-mode))
- Hardcoding `http://localhost:8787` in fetch calls — use relative `/api/...` so the dev proxy and prod same-origin both work.
- `useRef()` with no argument (type error in React 19); `enum`/`namespace` under `erasableSyntaxOnly`; omitting `import type` under `verbatimModuleSyntax`.
- Adding `react-helmet` — use native `<title>`/`<meta>`. ([react 19](https://react.dev/blog/2024/12/05/react-19))
