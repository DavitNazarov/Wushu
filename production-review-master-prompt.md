# Comprehensive Production Readiness & Architecture Review

## Role

You are Opus 4.8 acting as:
- Principal Software Engineer
- Staff Backend Engineer
- Staff Frontend Engineer
- Site Reliability Engineer (SRE)
- Security Engineer
- QA Lead
- Product Manager
- Systems Architect

Your goal is NOT to be nice.

Your goal is to find every weakness, bottleneck, failure point, scalability issue, security issue, UX issue, business logic issue, deployment risk, and operational risk before production.

---

# Phase 1 — Understand Everything First

Before giving recommendations:

1. Read the entire codebase.
2. Build a mental model of the system.
3. Identify:
   - Business idea
   - Core workflows
   - User types
   - Permissions model
   - Architecture
   - Database design
   - External services
   - Deployment architecture
4. Create a system map.
5. Create a user-flow map.
6. Explain the application back to me.

Do NOT review until you understand the entire system.

---

# Phase 2 — Architecture Review

Review:

- Folder structure
- Code organization
- Module boundaries
- Dependency management
- Separation of concerns
- Technical debt
- Maintainability
- Scalability

Identify:

- God objects
- Tight coupling
- Circular dependencies
- Over-engineering
- Under-engineering

Provide severity:

- Critical
- High
- Medium
- Low

---

# Phase 3 — Business Flow Analysis

Map every user journey.

For every flow:

- Sign up
- Sign in
- Logout
- Profile management
- Event registration
- Payments
- Notifications
- Administration
- Judge workflows
- Tournament workflows
- Reporting workflows

Find:

- Dead ends
- Confusing UX
- Missing states
- Race conditions
- Edge cases
- Permission gaps

Ask:

"What happens if the user does something unexpected?"

---

# Phase 4 — Security Audit

Review:

- Authentication
- Authorization
- Session management
- JWT handling
- Cookies
- API security
- Input validation
- Output encoding

Search for:

- XSS
- CSRF
- SSRF
- SQL injection
- Command injection
- Broken auth
- Broken access control
- IDOR
- Secret leakage
- Privilege escalation

Assume attackers are intelligent.

---

# Phase 5 — Database Review

Review:

- Schema
- Relations
- Indexes
- Constraints
- Cascades
- Query patterns

Find:

- Missing indexes
- N+1 queries
- Slow joins
- Table scans
- Locking issues
- Migration risks

Estimate scaling risks:

- 100 users
- 1,000 users
- 10,000 users
- 100,000 users

---

# Phase 6 — Performance Audit

Analyze:

Frontend:
- Bundle size
- Hydration issues
- Re-renders
- Memory leaks

Backend:
- Slow endpoints
- Blocking operations
- Inefficient queries
- Excessive API calls

Provide:

- Performance bottlenecks
- Estimated impact
- Recommended fixes

---

# Phase 7 — Reliability Review

Assume failures:

- Database unavailable
- Auth provider unavailable
- Email provider unavailable
- Cache unavailable
- Network failures

For every dependency answer:

1. What breaks?
2. User impact?
3. Recovery strategy?
4. Recommended fallback?

---

# Phase 8 — Production Readiness

Review:

- Environment variables
- Logging
- Monitoring
- Alerting
- Health checks
- Error tracking
- Backups
- Disaster recovery

Verify:

- Production configuration
- Secrets management
- Deployment safety

---

# Phase 9 — Load Testing Analysis

Estimate capacity.

Determine:

- Maximum concurrent users
- Likely bottlenecks
- Database saturation points
- CPU bottlenecks
- Memory bottlenecks

Design load tests for:

- Normal traffic
- Peak traffic
- Tournament day traffic
- Malicious traffic

---

# Phase 10 — Event Day Simulation

Simulate the worst day.

Examples:

- Hundreds of users register simultaneously
- Judges submit scores simultaneously
- Admin updates brackets
- Internet instability
- Database latency spikes

Identify every possible failure.

---

# Phase 11 — Testing Coverage

Review:

- Unit tests
- Integration tests
- E2E tests

List:

- Missing tests
- Critical untested flows
- Regression risks

---

# Phase 12 — Observability

Verify visibility into:

- Errors
- Performance
- Infrastructure
- User activity

Recommend:

- Dashboards
- Metrics
- Alerts

---

# Phase 13 — Deployment Review

Review deployment process.

Check:

- Rollbacks
- Blue-green deployment
- Canary releases
- Migration safety

Answer:

"What can permanently break production?"

---

# Phase 14 — Brutal Review

Act as a skeptical principal engineer.

Try to reject the launch.

List:

- Reasons not to launch
- Risks
- Unknowns
- Assumptions

Only approve launch if evidence supports it.

---

# Required Output Format

## System Understanding

## Architecture Review

## Business Flow Review

## Security Findings

## Database Findings

## Performance Findings

## Reliability Findings

## Scalability Findings

## UX Findings

## Production Readiness Findings

## Monitoring & Observability Findings

## Deployment Findings

## Missing Tests

## Event-Day Risks

## Launch Blockers

## Final Verdict

### Launch Decision

- APPROVED
- APPROVED WITH CONDITIONS
- NOT APPROVED

### Confidence Level

0–100%

### Top 20 Highest Priority Fixes

Rank by impact and urgency.

Do not assume anything is safe.
Attempt to break the system from every angle.
