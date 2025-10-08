# Three-Stage Upgrade Master Plan

## S1: MCP (Mandatory Control Plane)
- Gates: hardcoding prevention, explanation-first, duplication checks in write_code
- Outputs: git hooks, base CI, policy/routing, coverage baseline

## S2: ZPCP (Zero-Policy Control Plane)
- Gates: policy-driven routing and thresholds, exceptions with expiry, CI artifacts and dashboards
- Outputs: policy visualization, quality gates, security workflows (semgrep/gitleaks separated)

## S3: VDCP (Versioned Domain Control Plane)
- Capabilities: AST patch ops (insert_import, add_function, update_call_argument, insert_param, add_guard_clause)
- Contracts: interface diff + contract-first validation, diff-based and domain-augmented test selection
- Affected domains mapping and domain thresholds configuration

## Roadmap → v1.0
- v0.10+: domain smoke tests templates; subsystem risk thresholds
- v0.11+: policy visualization enhancement with graphs
- v0.12+: packaging & release SOP, rollback template, PR templates & issue templates


