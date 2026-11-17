# SIM PINTAR — Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Global Default-Deny & Verified Identity Invariant**:
   - All unmatched paths are unconditionally denied (`allow read, write: if false;`).
   - Every write operation requires a signed-in user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
2. **Master Gate & Relational Consistency Invariant**:
   - A `StaffPrivateDoc` (`/staff_profiles/{staffId}/private/{privateId}`) cannot exist or be accessed unless the parent `/staff_profiles/{staffId}` exists and its `authorId == request.auth.uid` (or the user is a verified Admin).
   - An `AttendanceDoc` (`/attendance_logs/{logId}`) or `PembinaanDoc` (`/pembinaan_records/{recordId}`) cannot be created unless the referenced `/students/{studentId}` document actually exists in Firestore.
3. **Anti-Update-Gap & Shadow Field Invariant**:
   - Every `create` and `update` call is gated by `isValid[Entity](incoming())`, which strictly enforces `keys().hasAll(...)` and `keys().hasOnly(...)`, exact field types, string `.size()` limits, and bounded list sizes (`peranTambahan.size() <= 6`, `kamarBinaan.size() <= 10`).
4. **Immutability & Temporal Integrity Invariant**:
   - Identity and creation metadata (`id`, `authorId`, `ownerId`, `studentId`, `createdAt`) cannot be mutated on `update`.
   - `createdAt == request.time` on `create` and `updatedAt == request.time` on `update`.
5. **Terminal State Locking Invariant**:
   - Once a `PembinaanDoc` reaches `statusTindakLanjut == 'Selesai'`, non-admin users are blocked from mutating the record.
6. **PII Isolation & Query Enforcement Invariant**:
   - Staff WhatsApp contact numbers are isolated inside `/staff_profiles/{staffId}/private/{privateId}` and restricted to `isOwner` or `isAdmin` on `get` only (`allow list: if false`).
   - All `allow list` rules enforce `resource.data.authorId == request.auth.uid` or verified bootstrapped admin identity without invoking `get()`/`exists()`.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 — Unverified Email Spoofing on Admin Access**:
   `auth: { uid: 'attacker_1', token: { email: 'sahidin30@gmail.com', email_verified: false } }` attempting to create `/students/STU_1`.
2. **Payload 2 — Shadow Field Injection on Student Create**:
   Adding an undeclared field `"isAdmin": true` to `/students/STU_1`.
3. **Payload 3 — Author UID Spoofing on Student Create**:
   Authenticated as `user_a`, attempting to create `/students/STU_1` with `authorId: "user_b"`.
4. **Payload 4 — ID Poisoning (Path Variable Mismatch / Oversized ID)**:
   Creating `/students/STU_BAD$ID!` with invalid characters or a 200-char ID.
5. **Payload 5 — Unbounded Array Exhaustion on Staff Profile**:
   Creating `/staff_profiles/STF_1` with `kamarBinaan` containing 15 rooms (`size() > 10`).
6. **Payload 6 — Array Element Type Poisoning on Staff Profile**:
   Creating `/staff_profiles/STF_1` where `peranTambahan: [12345]` (non-string first element).
7. **Payload 7 — PII Cross-User Snooping**:
   Authenticated as `user_b`, attempting `get` on `/staff_profiles/STF_1/private/contact` owned by `user_a`.
8. **Payload 8 — Orphaned Attendance Log Creation**:
   Creating `/attendance_logs/LOG_1` referencing a non-existent `studentId: "NON_EXISTENT_STUDENT"`.
9. **Payload 9 — Forged Client Timestamp on Create**:
   Creating `/schedules/SCH_1` with a past/future `createdAt` not equal to `request.time`.
10. **Payload 10 — Immutable `authorId` Tampering on Update**:
    Updating `/schedules/SCH_1` while changing `authorId` from `user_a` to `user_b`.
11. **Payload 11 — Value Poisoning on Action-Based Update**:
    Updating `/attendance_logs/LOG_1` with whitelisted key `status: "INVALID_STATUS_LONGER_THAN_8"`.
12. **Payload 12 — Terminal State Re-opening on Pembinaan Record**:
    Non-admin owner attempting to update `/pembinaan_records/REC_1` after `existing().statusTindakLanjut == 'Selesai'`.
