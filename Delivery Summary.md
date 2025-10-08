# Delivery Summary

## Scope
This delivery consolidates v0.1.0 – v0.9.0 of Xiaoliu MCP Guardian, covering MCP → ZPCP → VDCP capabilities, with CI gates, hooks, policy routing, AST patching, diff-based test selection, contracts, exceptions lifecycle, and affected-domain analysis.

## Versions Included
- v0.1.0: Initial hooks, CI bootstrap, policy routing
- v0.2.0: AST insert_import, add_function, update_call_argument; security hardening
- v0.3.0: Exceptions management and dynamic thresholds
- v0.4.0: AST insert_param, add_guard_clause
- v0.5.0: Advanced diff-based tests and policy visualization
- v0.6.0: Contract validation and interface diff
- v0.7.0: Contract-first validation, exceptions expiry cleanup
- v0.8.0: Affected domains mapping (reports/affected-domains.{txt,json})
- v0.9.0: Domain thresholds and augmented tests (reports/tests-to-run-augmented.txt)

## Key Artifacts (CI)
- reports/changed-files.txt
- reports/diff-test-pattern.txt
- reports/tests-to-run.txt
- reports/tests-to-run-augmented.txt
- reports/affected-domains.{txt,json}
- reports/policy-report.{json,md}
- coverage/coverage-summary.json, reports/coverage-summary.txt
- reports/quality-summary.txt
- reports/interface-diff.{json,md}
- reports/contract-check.{json,md}
- reports/expiry-report.md
- reports/ci-dashboard.md

## How to Verify Quickly
1) Change a file under src/utils/** and push a PR → CI should show policy routing and thresholds applied accordingly, and tests filtered via advanced diff + augmented by affected domains.
2) Update policy/routing.json or policy/domain-thresholds.json → CI behavior changes without code changes (configuration-driven).
3) Run local scripts (PowerShell):
   - scripts/preflight.ps1
   - scripts/check_quality.ps1
   - scripts/policy_report.ps1
   - scripts/run_reports.ps1

## Next Steps
- Prepare v1.0 packaging and release SOP
- Expand domain mapping to subsystem-level and add risk-based thresholds
- Add smoke tests per domain (tests/smoke/<domain>.smoke.test.*)


