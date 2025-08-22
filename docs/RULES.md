# RULES.md

## Purpose
Omneuro development and operations are guided by hard rules.  
These rules exist because every one of them cost us time, energy, or clarity.  
They are designed to keep humans and AI in sync, avoid repeated mistakes,  
and enforce a disciplined, professional workflow.  

Rules are **non-negotiable**. They should be short, direct, and actionable.  

---

## Core Development Rules

1. **Logs before code** – Never debug blind. Insert logs at every service boundary before writing fixes.  
2. **Three-strike debug reset** – If the same test fails 3 times, stop. Re-check assumptions, logs, and contracts.  
3. **No phantom endpoints** – Every endpoint must exist in code, schema, and docs.  
4. **Contract-first discipline** – Schema and ADRs are the source of truth. Code must follow contracts, never the other way around.  
5. **Secrets are never in Git** – Always in `.secrets/` and ignored. Handle with SSM or environment injection.  
6. **Every deploy script is executable** – Scripts self-apply `chmod +x`.  
7. **Health checks are canonical** – Services must publish documented health endpoints.  
8. **Retry, don’t panic** – Health checks always retry with backoff before failing.  
9. **One source of truth per concept** – Contracts in `SCHEMA.md`, ops in `OPS.md`, observability in `OBSERVABILITY.md`. Never duplicate.  
10. **Cross-reference everything** – If a runbook entry, checklist, or rule exists, link it. Don’t fragment knowledge.  

---

## Human–AI Collaboration Rules

11. **Re-sync often** – When drift happens (human confuses AI, or AI forgets), re-read `README-ops.md` and docs.  
12. **Keep debug chatter out of docs** – Only clean knowledge makes it into the repo.  
13. **Don’t assume memory** – Always restate context when starting a dev session.  
14. **Humans confirm before execution** – AI can propose, human executes only after checking.  
15. **AI confirms before suggestion** – Never hallucinate commands; verify against docs or repo structure.  
16. **Noise filter discipline** – Retro lessons and chat noise must be distilled into rules, not left raw.  
17. **Document the fix** – Every resolved error path becomes a runbook entry.  
18. **One step at a time** – Don’t chain unverified fixes. Validate before moving.  

---

## Ops & AWS Rules

19. **Validate IAM first** – Most AWS failures are IAM-related. Always `aws sts get-caller-identity` before assuming code is wrong.  
20. **Check region always** – Many failures came from wrong AWS region. Default to `us-east-1` unless explicitly overridden.  
21. **SSM is strict** – Ensure agent is running, permissions are set, and parameters exist before deploying.  
22. **Logs are gold** – CloudWatch must always have logs. If silent, fix logging first.  
23. **Standard log groups** – Use canonical log group names, documented in `OBSERVABILITY.md`.  
24. **No manual AWS edits** – All infra changes go through Terraform/CDK or documented scripts.  
25. **Auto-logs, auto-deploy** – Deployment must emit logs by default; no silent pipelines.  
26. **ECS stabilization required** – Never trust a green until ECS tasks show healthy.  
27. **IAM least privilege** – Grant only what’s needed. Debug with admin, then roll back to minimal.  
28. **Token freshness** – Rotate and validate tokens before every deploy.  

---

## Git & Workflow Rules

29. **Never reset without backup** – Git resets must not destroy `.secrets`, configs, or ADRs.  
30. **Commits are atomic** – One logical change per commit. Scripts, configs, and docs updated together.  
31. **Docs update with code** – Every change must include documentation.  
32. **ADR for every decision** – Major changes require an ADR entry.  
33. **Use feature branches** – Never commit experimental changes directly to main.  
34. **Pull, then chmod** – `redeploy.sh` must always reset its own perms after pull.  
35. **Check diff before push** – Avoid committing debug or noise.  
36. **No deploy without green tests** – All health checks must pass before production deploy.  
37. **Don’t repeat past mistakes** – If it’s in the runbook, check it before re-debugging.  

---

## Debugging Rules

38. **Start simple** – Always check permissions, regions, and logs before touching code.  
39. **Boundary testing** – Verify where the request fails: gateway, service, schema, or infra.  
40. **Instrument first** – Add metrics/tracing before deep debug loops.  
41. **Stop log blindness** – If logs don’t explain the failure, fix observability first.  
42. **No assumption loops** – Don’t spend cycles guessing. Validate with evidence.  
43. **Escalate after 3 cycles** – If stuck, escalate to ADR or retro.  
44. **Use structured logs** – Include request IDs, timestamps, correlation data.  
45. **Always curl the endpoint** – Don’t trust assumptions; test endpoints directly.  

---

## Cultural Rules

46. **Spartan docs** – Short, clear, referenceable. No fluff.  
47. **Respect the checklist** – Checklists exist because we failed without them. Use them.  
48. **Retro discipline** – Every sprint ends with a retro distilled into rules.  
49. **No startup chaos** – Move like professionals, not hobbyists.  
50. **Leave rope, not threats** – Communication (internal and external) is assertive but respectful.  

---

## Cross-References

- **OPS.md** – Operating principles, system-wide lessons.  
- **OBSERVABILITY.md** – Metrics, tracing, logs.  
- **CHECKLISTS.md** – Step-by-step sanity checks.  
- **RUNBOOK.md** – Recovery actions for failures.  
- **SCHEMA.md** – Contracts and definitions.  

---

✅ This file contains **the distilled discipline of Omneuro**.  
Follow these rules and you will not repeat our mistakes.  
Break them, and you will burn cycles we already paid for.  