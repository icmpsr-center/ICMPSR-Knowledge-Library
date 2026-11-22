# ICMPSR Admin Control Center — Development Baseline

Status: **Development / prototype only**. Not production ready.

## Preservation decision (2026-11-22)
- Keep the deployed knowledge-library site unchanged.
- Develop the admin control center on branch `development/admin-control-center-v5`.
- Preserve V5 standalone preview as baseline. The preview is a browser-memory mock, not a Supabase-connected application.
- Each new project module must be represented in the admin permission catalog before final integration.
- No merge into `main`, Pages deployment, or production database changes without explicit approval.

## Functional scope
1. Accounts: create/edit/disable users; username, email, phone, job title, description, department, reporting manager.
2. Secure authentication: Supabase Auth; passwords via server-side admin operations and recovery flow. Never store plaintext passwords.
3. Dynamic roles, action permissions, and per-user overrides (inherit/allow/deny).
4. Hierarchical departments and department heads.
5. Access scopes: own department, descendants, selected departments, all departments.
6. Module-level permission matrices: central/private knowledge libraries, categories, document proposals, files, reports, access logs, and future modules.
7. Trainee feature visibility distinct from authorization.
8. Audit trail and protection against removal/disable of the last super_admin.

## Security gates
- Enforce authorization in server APIs and Supabase RLS, not only the frontend.
- Review existing `private.is_admin()` behavior, which currently treats `training_manager` as administrative.
- Implement least privilege, validation, safe account recovery, and audit events.
- No production migration until schema review and backup.

## Development phases
- [x] Create isolated development branch.
- [ ] Commit V5 preview source to branch.
- [ ] Implement database schema and migrations.
- [ ] Implement authentication and authorization services.
- [ ] Connect frontend to Supabase.
- [ ] Integrate project modules progressively.
- [ ] Test responsive UI, access controls, recovery, and audit logging.
- [ ] Obtain explicit approval before production deployment.

This document is a project continuity checkpoint, not a claim of feature completion.
