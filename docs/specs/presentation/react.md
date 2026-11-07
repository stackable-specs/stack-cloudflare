---
id: react
layer: presentation
extends: []
---

# React

## Purpose

React's rendering model depends on a short list of invariants — pure components, hooks called unconditionally at the top level, side effects isolated from render, stable keys across reorderings — that together make `Component(props) => UI` a function rather than a side-effect machine. Violations do not fail loudly. They produce stale closures, double-mounted effects, lost input focus, infinite update loops, and accessibility gaps that only surface under concurrent rendering or specific state transitions. This spec pins the Rules of React, hook discipline, and accessibility baseline so the framework's guarantees stay intact and so the ESLint + a11y toolchain is a reliable gate rather than advisory noise.

## References

- **spec** `typescript` — React components in this repo follow the general TypeScript rules
- **external** `https://react.dev/` — React home
- **external** `https://react.dev/reference/rules` — Rules of React (purity, hooks, identity)
- **external** `https://react.dev/reference/react/hooks` — Hooks API reference
- **external** `https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks` — `eslint-plugin-react-hooks`
- **external** `https://github.com/jsx-eslint/eslint-plugin-jsx-a11y` — `eslint-plugin-jsx-a11y`

## Rules

1. Write components as function components; do not introduce class components in new code.
2. Call hooks only at the top level of a React function — never inside loops, conditionals, early returns, or nested functions. (refs: https://react.dev/reference/rules/rules-of-hooks)
3. Call hooks only from React function components or other custom hooks; do not call hooks from regular functions, event handlers, or module scope.
4. Keep components and hooks pure: do not mutate props, state, refs, or shared module-level values during render.
5. Do not read from or write to the DOM, perform network I/O, or subscribe to external stores during render; put those in `useEffect`, `useSyncExternalStore`, or the appropriate primitive.
6. Return a cleanup function from every effect that subscribes, listens, opens a socket, or allocates a timer.
7. List every reactive value the effect closes over in the dependency array of `useEffect`, `useMemo`, and `useCallback`; enable `react-hooks/exhaustive-deps` and treat violations as errors.
8. Do not store derived values in state; compute them during render from props and existing state.
9. Choose `useState` for independent local values and `useReducer` when transitions between multiple states must be coordinated.
10. Do not wrap components in `React.memo` or values in `useMemo` / `useCallback` without a measured performance reason.
11. Provide a stable, unique `key` when rendering lists; do not use the array index as a key for lists that can be reordered, inserted into, or removed from.
12. Render form inputs as controlled components (`value` + `onChange`) when the form owns the data; use uncontrolled inputs with refs only to integrate with non-React libraries.
13. Lift state to the lowest common ancestor that reads it; do not duplicate the same state in sibling components.
14. Use React Context for genuinely cross-cutting values with low update frequency (theme, auth, locale); do not use context as a general-purpose DI container for values that change every render.
15. Wrap asynchronous rendering (data fetching, `React.lazy` code splitting) in a `<Suspense>` boundary with a fallback; do not replicate loading-state booleans at every data-consuming call site.
16. Catch rendering errors with an `ErrorBoundary` at meaningful subtree roots; do not wrap render code in `try` / `catch` to recover from component errors.
17. Enable `<StrictMode>` at the application root in development so rule violations surface via double-invocation.
18. Type component props with a TypeScript `type` or `interface`; do not type props as `any`.
19. Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<label>`, `<dialog>`, etc.) for their intended roles; add `aria-*` attributes only to supplement behavior HTML cannot express.
20. Provide an `alt` attribute on every `<img>`; use `alt=""` for purely decorative images so assistive tech can skip them.
21. Enforce React rules with `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y` in CI; treat diagnostics from these plugins as build failures.
22. Name component files and exported components in `PascalCase`; prefer named exports over default exports for refactor-friendly imports.
