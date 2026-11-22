# Supabase Structure Review — 2026-11-22

Project: `icmpsr-platform`
Project ref: `hfosaegedytkugtwsqdb`
Database: PostgreSQL 17
Review type: Read-only inspection. No schema, data, Auth, or production settings were changed.

## Current foundation
- 29 tables were found in the `public` schema; all 29 have RLS enabled.
- Existing identity model:
  - `public.profiles` (primary key references `auth.users.id`)
  - `public.user_roles` (composite key `user_id, role`)
  - Existing enum `app_role`: `super_admin`, `training_manager`, `scientific_supervisor`, `registration_officer`, `finance_officer`, `support`, `trainer`, `trainee`.
- Existing functional domains include courses, course versions, trainers, modules, lessons, lesson assets, registrations, enrollments, assessments, questions, attempts, certificates, learner progress/notes/CV, notifications, knowledge libraries/documents/categories/chunks/proposals/links/access logs, and audit logs.
- Existing migrations include the foundation/security-hardening/bootstrap migrations and subsequent course, trainee, assessment, and knowledge-library migrations. The current migration list ends with `seed_trainer_library_categories`.

## Important authorization behavior
- `private.has_role(app_role)` checks `public.user_roles` for the current `auth.uid()`.
- `private.is_admin()` returns true for either `super_admin` OR `training_manager`.
- Multiple existing RLS policies use `private.is_admin()` for full management of courses, course versions, trainers, modules, lessons, registrations, assessments, certificates, knowledge libraries, documents, chunks, and administrative audit access.
- Therefore, the current `training_manager` role is effectively privileged as an administrator across many existing modules. This behavior must be explicitly reviewed before changing it; do not replace or narrow it without a compatibility and authorization plan.

## Security advisor findings (observed 2026-11-22)
1. Warning: signed-in users can execute SECURITY DEFINER RPC functions:
   - `public.get_my_assessment_analysis()`
   - `public.submit_assessment_attempt(uuid, jsonb)`
   Review their function bodies, grants, and intended caller model before changing privileges.
2. Warning: leaked-password protection is disabled in Supabase Auth. Enable after reviewing Auth configuration and rollout impact.

## Architecture recommendation (not yet implemented)
- Preserve the existing `app_role` values and `user_roles` compatibility initially.
- Add a permission catalog, role-permission mapping, per-user allow/deny overrides, departments, reporting relationships, and access-scope mappings as additive structures.
- Keep action permissions separate from data scope and trainee UI visibility.
- Enforce authorization in RLS and trusted server-side operations; hiding buttons in the UI is not security.
- Use Supabase Auth for credentials. Never store plaintext passwords or expose service-role credentials to the browser.
- Protect the last active `super_admin` from removal or deactivation.
- Map current roles and policies into the new model only after a policy-by-policy compatibility review.

## Next implementation gates
- [ ] Inspect full table definitions and policy dependencies for the admin-related entities.
- [ ] Design additive RBAC/department schema and migration on an isolated development database/branch.
- [ ] Define role-to-permission compatibility mapping, especially `training_manager`.
- [ ] Review SECURITY DEFINER RPC bodies and grants.
- [ ] Test RLS with representative users for every role and scope.
- [ ] Obtain explicit approval before any production migration or deployment.

This is a read-only audit snapshot, not a completed security remediation.
