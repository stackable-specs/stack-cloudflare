# ADR-007: Serve published artifacts as plain text

## Status

Accepted

## Context and Problem Statement

Submissions are untrusted HTML. If the application serves that HTML as `text/html` on its own origin, a submission can run script in the context of the application. R2 buckets must stay private (`docs/specs/platform/cloudflare.md` rule 18).

## Considered Options

- Serve the published copy through the Worker as `text/plain` with `nosniff`.
- Serve the published copy as `text/html` from a separate, isolated origin.
- Make the R2 bucket public.

## Decision Outcome

Chosen option: serve through the Worker as `text/plain` with `nosniff`, because it needs no extra origin and keeps the bucket private.

We will serve `GET /api/submissions/<id>/artifact` only when the status is `published`, only from the `published/` prefix, with `content-type: text/plain; charset=utf-8` and `x-content-type-options: nosniff`.

## Consequences

- Good: submitted HTML cannot run in the application origin.
- Good: the R2 bucket has no public access.
- Bad: users cannot view a rendered page. A rendered view needs a separate, isolated origin in a new ADR.

## References

- [BDR-003](../bdr/003-published-artifact-retrieval.md)
- `docs/specs/platform/cloudflare.md` rule 18
