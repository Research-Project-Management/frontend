# Postmortems (Incident → Guardrail Loop)

Write a short postmortem whenever a bug or UI/architectural regression escapes into `main` or production and is **systemic** or **recurs twice**.

1. **Executive summary** (what broke, root cause, why gates missed it, durable fix).
2. **Root cause & mechanism** (exact files/conditions).
3. **Permanent guardrail added** (link to the new rule in `.oxlintrc.json`, `eslint.config.mjs`, `.dependency-cruiser.js`, `scripts/gates/`, or test).
