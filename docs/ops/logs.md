# logs.md

## Omneuro Logging Standards

Logs are our eyes. If we can’t see, we can’t operate.  
This file defines how logs are structured, filtered, and used.

---

### 1. Log Philosophy

- Logs are **for humans + AI**. Both must parse them clearly.  
- Structured JSON only.  
- No noise. If logs are unreadable → fix the logging, not the service.  

---

### 2. Levels

- **DEBUG** → Local dev only. Never ship to prod.  
- **INFO** → Normal service state.  
- **WARN** → Something off, but service still OK.  
- **ERROR** → Immediate human attention needed.  
- **FATAL** → Service crash. Must trigger alert.  

---

### 3. Observability Integration

- All logs stream into **CloudWatch**.  
- Local dev → `docker logs -f <service>`.  
- Health checks always log **success + failure**, never silently fail.  
- Logs tied directly to metrics + alerts (see `OBSERVABILITY.md`).  

---

### 4. Anti-Patterns

- **Do not** spam debug. Use selective, contextual logs.  
- **Do not** log secrets (tokens, passwords, API keys).  
- **Do not** rely only on stack traces — add context.  
- **Do not** leave logs unstructured.  

---

### 5. Rules from Lessons

- Always add request IDs to correlate across services.  
- Logs must be greppable.  
- Every retry/healthcheck logs both failure + eventual success.  
- Noise in logs = wasted cycles → trim aggressively.  
- Log rotation enforced; old logs auto-expire.  
- If you can’t explain a log line’s purpose, delete it.  

---

### 6. Debug Discipline

When debugging:  
1. Check health endpoints first.  
2. Tail logs with grep filters (don’t drown).  
3. Isolate one variable at a time.  
4. If nothing makes sense → sanity reset (`sanity.md`).  

---

**Final Note:**  
Logs are the most common source of wasted cycles.  
Follow these standards, and you’ll never drown again.  