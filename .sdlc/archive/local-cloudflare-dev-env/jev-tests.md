# Jev check — tests (local-cloudflare-dev-env)

**Overall: review**  ·  model `typesafe/jev-1.14-20261014`  ·  cost $0.000349188

| Question | Result | Value |
|---|---|---|
| tests assert on results a caller sees | pass | 2.90 of 3: all |
| tests fail if the code returns nothing | pass | 2.57 of 3: all |
| tests check only calls to internal collaborators | pass | P(yes) = 0.13 |
| tests depend on private implementation details | UNCERTAIN | P(yes) = 0.35 (near threshold) |
| test names describe behavior | pass | P(yes) = 0.93 |

Jev judges the text only. Thresholds are uncalibrated starting points.
