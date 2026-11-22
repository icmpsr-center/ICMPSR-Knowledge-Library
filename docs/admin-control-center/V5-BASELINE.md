# V5 UI Baseline — Admin Control Center

Date: 2026-11-22
Status: Prototype snapshot; browser-only demonstration.

## Source identity
- Original filename: `icmpsr-admin-control-center-v5.html`
- SHA-256: `1f4b64790c303497d1f332b39b53a3e0f1e8e783d934ec1dc17f1d706a018a8d`
- The five-version preservation archive was generated as `ICMPSR-Admin-Control-Center-V5-Backup.zip` and supplied in the working conversation.
- This checksum identifies the V5 file exactly. Do not silently replace it with a re-created or reformatted version.

## V5 sections
1. Users and employee accounts.
2. Dynamic role definitions.
3. Role permission matrix.
4. Organizational hierarchy and department assignments.
5. Access scope configuration.
6. Library-module permissions.
7. Trainee interface feature visibility.
8. Audit-log preview.

## Prototype limitations
- Data and changes exist in browser memory only.
- Account creation, password reset, role changes, scopes, and audit entries are simulated.
- No real Supabase Auth calls, database persistence, server authorization, or RLS enforcement exists in this HTML.
- Sample records are demonstration data and must not be imported as real accounts.

## Preservation rules
- Keep this exact V5 snapshot as the UI baseline.
- Future implementation should be built as a separate connected application and compared against this baseline.
- Do not expose the prototype as a live admin portal.
- Do not merge to the default branch or deploy without explicit approval.
