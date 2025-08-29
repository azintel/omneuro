# OBSERVABILITY.md

## Observability Guide

Omneuro relies on strong observability to prevent blind debugging loops and wasted cycles. This document defines the standards, practices, and lessons learned.

---

## 1. Principles

- **Measure everything.** If it isn’t logged, it doesn’t exist.  
- **Single source of truth.** CloudWatch is the system of record.  
- **Fast feedback.** Errors must surface within seconds.  
- **Minimal noise.** Logs should be actionable, not spammy.  
- **Correct user context.** Observability setup and verification commands must be executed as the `ubuntu` user with `sudo` in SSM sessions.

---

## 2. Health Checks

- Every service implements `GET /healthz`.  
- `tech-gateway` adds `GET /api/tech/health`.  
- Health check script retries 5× with backoff.  
- No phantom endpoints are allowed in tests.  
- Health checks must be run under `ubuntu` to ensure correct environment and permissions.  

---

## 3. Logging

- **CloudWatch**:  
  - Each service streams logs by `service/env`.  
  - Standardized JSON format for parsing.  
- **Local dev**:  
  - Console logging only.  
  - No debug spam in production builds.  
- **Error logging**:  
  - Stack traces logged once, not repeatedly.  
  - Redacted sensitive data (secrets, tokens).  

---

## 4. Metrics

- Success/failure counts for health endpoints.  
- Deploy success/failure metrics tied to `redeploy.sh`.  
- Latency measurements for API calls.  
- Error rate thresholds trigger rollback.  

---

## 5. Lessons Learned

- **Blind debugging** cost days → fixed by adding CloudWatch + local logs.  
- **Inconsistent stream names** broke dashboards → now enforced in config.  
- **Debug noise** obscured real errors → strict filtering in production logs.  
- **Phantom endpoints** wasted time → strict endpoint registry.  
- **Wrong user context** in SSM caused missing logs/metrics → rule: always switch to `ubuntu`.  

---

## 6. References

- `logs.md` → detailed log management.  
- `sanity.md` → periodic sanity checks.  
- `deploy-ops.md` → integrated health checks.  

---