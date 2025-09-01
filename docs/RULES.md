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
11. **Single-block discipline** – All doc updates must be output in one fenced block containing the entire file. No plaintext spills, no partials.  
12. **Repo is the source of truth** – Always scan the repo first before editing code or docs. Never deprecate or overwrite without confirmation.  

---

## Human–AI Collaboration Rules

13. **Re-sync often** – When drift happens (human confuses AI, or AI forgets), re-read `README-ops.md` and docs.  
14. **Keep debug chatter out of docs** – Only clean knowledge makes it into the repo.  
15. **Don’t assume memory** – Always restate context when starting a dev session.  
16. **Humans confirm before execution** – AI can propose, human executes only after checking.  
17. **AI confirms before suggestion** – Never hallucinate commands; verify against docs or repo structure.  
18. **Noise filter discipline** – Retro lessons and chat noise must be distilled into rules, not left raw.  
19. **Document the fix** – Every resolved error path becomes a runbook entry.  
20. **One step at a time** – Don’t chain unverified fixes. Validate before moving.  

---

## Ops & AWS Rules

21. **Validate IAM first** – Most AWS failures are IAM-related. Always `aws sts get-caller-identity` before assuming code is wrong.  
22. **Check region always** – Many failures came from wrong AWS region. Default to `us-east-1` unless explicitly overridden.  
23. **SSM is strict** – Ensure agent is running, permissions are set, and parameters exist before deploying.  
24. **Logs are gold** – CloudWatch must always have logs. If silent, fix logging first.  
25. **Standard log groups** – Use canonical log group names, documented in `OBSERVABILITY.md`.  
26. **No manual AWS edits** – All infra changes go through Terraform/CDK or documented scripts.  
27. **Auto-logs, auto-deploy** – Deployment must emit logs by default; no silent pipelines.  
28. **ECS stabilization required** – Never trust a green until ECS tasks show healthy.  
29. **IAM least privilege** – Grant only what’s needed. Debug with admin, then roll back to minimal.  
30. **Token freshness** – Rotate and validate tokens before every deploy.  
31. **Correct user context** – All operational commands must be run as the `ubuntu` user with `sudo`. Running as `ssm-user` without escalation will fail.  
32. **Nginx/TLS consistency** – All site configs must validate with `nginx -t` and `/nginx-health` before deploy. Certbot is the canonical TLS manager.  

---

## Git & Workflow Rules

33. **Never reset without backup** – Git resets must not destroy `.secrets`, configs, or ADRs.  
34. **Commits are atomic** – One logical change per commit. Scripts, configs, and docs updated together.  
35. **Docs update with code** – Every change must include documentation.  
36. **ADR for every decision** – Major changes require an ADR entry.  
37. **Use feature branches** – Never commit experimental changes directly to main.  
38. **Pull, then chmod** – `redeploy.sh` must always reset its own perms after pull.  
39. **Check diff before push** – Avoid committing debug or noise.  
40. **No deploy without green tests** – All health checks must pass before production deploy.  
41. **Don’t repeat past mistakes** – If it’s in the runbook, check it before re-debugging.  

---

## Debugging Rules

42. **Start simple** – Always check permissions, regions, and logs before touching code.  
43. **Boundary testing** – Verify where the request fails: gateway, service, schema, or infra.  
44. **Instrument first** – Add metrics/tracing before deep debug loops.  
45. **Stop log blindness** – If logs don’t explain the failure, fix observability first.  
46. **No assumption loops** – Don’t spend cycles guessing. Validate with evidence.  
47. **Escalate after 3 cycles** – If stuck, escalate to ADR or retro.  
48. **Use structured logs** – Include request IDs, timestamps, correlation data.  
49. **Always curl the endpoint** – Don’t trust assumptions; test endpoints directly.  

---

## Cultural Rules

50. **Spartan docs** – Short, clear, referenceable. No fluff.  
51. **Respect the checklist** – Checklists exist because we failed without them. Use them.  
52. **Retro discipline** – Every sprint ends with a retro distilled into rules.  
53. **No startup chaos** – Move like professionals, not hobbyists.  
54. **Leave rope, not threats** – Communication (internal and external) is assertive but respectful.  

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