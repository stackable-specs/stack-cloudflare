---
id: typescript
layer: language
extends: []
---

# TypeScript

## Purpose

TypeScript's value comes entirely from its type system; loosening the compiler or escaping into `any` silently converts a TypeScript codebase into a JavaScript one with extra ceremony. This spec pins the compiler configuration, module system, and idiomatic patterns that keep the type system load-bearing — so the compiler catches real defects, refactors stay safe, and `tsc` output is a reliable gate rather than an advisory check.

## References

- **external** `https://www.typescriptlang.org/docs/handbook/` — TypeScript Handbook
- **external** `https://www.typescriptlang.org/tsconfig` — tsconfig reference
- **external** `https://typescript-eslint.io/` — typescript-eslint rules and configuration
- **external** `https://google.github.io/styleguide/tsguide.html` — Google TypeScript Style Guide
- **external** `https://github.com/microsoft/TypeScript/wiki/Performance` — TypeScript compiler performance guidance

## Rules

1. Pin the TypeScript compiler version as a `devDependency` in `package.json` with an exact version (no `^` or `~`), and upgrade it deliberately via a dedicated PR.
2. Enable `"strict": true` in every `tsconfig.json`; do not disable any of the individual strict flags it implies.
3. Enable `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noFallthroughCasesInSwitch` in `tsconfig.json`.
4. Run `tsc --noEmit` in CI on every package; treat any diagnostic as a build failure.
5. Format every `.ts` / `.tsx` file with Prettier using a single committed config; CI must fail on unformatted files.
6. Lint with ESLint and `@typescript-eslint` using the `recommended-type-checked` preset at minimum; do not disable rules inline without a comment explaining why.
7. Do not use the `any` type; use `unknown` for values whose shape is not yet known and narrow with type guards before use.
8. Do not use the non-null assertion operator (`!`); narrow via a conditional, an assertion function, or an explicit throw.
9. Do not use type assertions (`as Foo`) except at system boundaries where runtime validation has already occurred; prefer user-defined type guards or schema validators (e.g. Zod) at those boundaries.
10. Use `readonly` modifiers on fields, arrays, and tuples that are not intended to be mutated; prefer `ReadonlyArray<T>` over `T[]` in function parameters.
11. Use ES module syntax (`import` / `export`); do not use `require()` or `module.exports` in `.ts` files.
12. Declare exported function signatures with explicit return types; rely on inference only for local variables and internal helpers.
13. Prefer `interface` for object shapes intended to be extended or implemented; use `type` for unions, intersections, tuples, and mapped/conditional types.
14. Do not use `enum`; use a union of string literal types or an `as const` object for named constants. (refs: https://www.typescriptlang.org/docs/handbook/enums.html)
15. Exhaustively check discriminated unions in `switch` statements with a `default` branch that assigns to a `never`-typed variable.
16. Use `undefined` rather than `null` for absent values; reserve `null` for interop with APIs that explicitly produce it.
17. Declare variables with `const` by default and `let` only when reassignment is required; do not use `var`.
18. Do not leave floating promises; `await`, `return`, or explicitly `void` every promise-returning call (enforced by `@typescript-eslint/no-floating-promises`).
19. Use `async` / `await` for asynchronous flow; do not mix `await` with raw `.then()` / `.catch()` chains in the same function.
20. Name types, interfaces, and classes in `PascalCase`; name variables, functions, and methods in `camelCase`; name module-level constants meant as compile-time literals in `UPPER_SNAKE_CASE`.
21. Prefix intentionally unused parameters and bindings with `_` so lint rules can distinguish them from accidental unused code.
22. Do not publish types derived from `any` across a package boundary; re-export explicit types or schema-validated types instead.
