# Bible Institute LMS — Final Architecture & Execution Plan (v3)

> [!IMPORTANT]
> **Scope:** four portals (Institute Admin, Teacher, Student, Super Admin). The Public Website is **postponed to Phase 11** and will not be started until all portals are done and approved by you.
> **Database safety:** no `migrate reset`, `db push --accept-data-loss`, `TRUNCATE`, `DROP` or destructive migrations on any shared database without your explicit written approval. A backup is taken before every approved schema change.

---

## 1. Current State (verified)

| Item | Finding |
| :--- | :--- |
| Workspace `BIBLE-Management` | Empty. No existing code, schema or auth to preserve. |
| `Desktop\bible_institute_lms_updated.html` | Single-file UI prototype with mock data (courses, students, teachers, classes). Nothing is saved; data resets on reload. **Its mock data and screen list will be reused as seed data and a checklist for screens.** |
| Toolchain | Node v24.15, npm 11.12. **No local PostgreSQL (`psql`) and no Docker.** We need a database before migrations can run (see §12). |

---

## 2. System Architecture

```mermaid
graph LR
    subgraph Client
        WEB["Next.js 15 web app (Vercel)<br/>4 portals + login"]
    end
    subgraph Backend ["NestJS API (Render / Railway / AWS)"]
        API["REST API /api/v1<br/>Guards: Auth, Tenant, RBAC, Policy"]
        WORKER["Worker process<br/>BullMQ jobs"]
    end
    subgraph Data
        PG[("PostgreSQL<br/>Prisma ORM<br/>+ Row-Level Security")]
        REDIS[("Redis<br/>queues, rate limits, cache")]
        STORE[("Private object storage<br/>S3 / R2 / GCS")]
    end
    subgraph External
        FB["Firebase Auth<br/>(phone OTP)"]
        RZP["Razorpay"]
        GCAL["Google Calendar / Meet"]
        MAIL["Email provider"]
        SMS["SMS provider (DLT)"]
        FCM["FCM web push"]
        VID["Video host with signed playback"]
    end

    WEB -- "same-origin /api proxy (rewrites)" --> API
    WEB -- "OTP + reCAPTCHA" --> FB
    API --> PG
    API --> REDIS
    API -- "signed URLs" --> STORE
    API --> RZP
    RZP -- "webhooks" --> API
    WORKER --> PG
    WORKER --> REDIS
    WORKER --> MAIL
    WORKER --> SMS
    WORKER --> FCM
    WORKER --> GCAL
    API --> VID
```

**Rules that keep the layers separate**
- **Next.js** only handles UI, routing and calling the API. It has no database access and no business logic. Its middleware only *redirects* users based on the role claim; the real permission checks happen in NestJS.
- **NestJS** owns all business logic, validation, authorization, payments, file signing and notifications.
- **Same-origin proxy:** Next.js `rewrites` forwards `/api/*` to NestJS, so auth cookies stay first-party (`HttpOnly`, `Secure`, `SameSite=Lax`) even though web and API are hosted separately.
- **Shared package** (`packages/shared`): role/permission constants, Zod schemas and DTO types used by both apps. The API client is generated from NestJS's OpenAPI spec, so there are no hand-written duplicate endpoints.

### 2.1 Repository layout (npm workspaces monorepo)

```
BIBLE-Management/
├─ apps/
│  ├─ api/                     NestJS
│  │  ├─ prisma/               schema.prisma, migrations/, seed/
│  │  ├─ src/core/             config, prisma, tenancy, auth, rbac, audit, health, logging, throttling, queue
│  │  ├─ src/modules/          one folder per domain module (§6)
│  │  └─ test/                 unit, integration, e2e, permission-matrix
│  └─ web/                     Next.js (App Router, TypeScript, Tailwind)
│     ├─ src/app/(auth)/login
│     ├─ src/app/admin/…  teacher/…  student/…  super-admin/…
│     ├─ src/components/ui/    design-system primitives
│     └─ src/lib/api/          generated typed client + TanStack Query hooks
├─ packages/shared/            roles, permissions, zod schemas, types
├─ docs/                       ARCHITECTURE.md, IMPLEMENTATION_PROGRESS.md, DATABASE_SAFETY.md, RUNBOOKS
└─ .github/workflows/ci.yml    lint, typecheck, test (Postgres service), build
```

### 2.2 Technology choices

| Concern | Choice | Why |
| :--- | :--- | :--- |
| Web | Next.js 15, React 19, TypeScript, Tailwind, Radix primitives, Motion (Framer), Recharts, TanStack Query | Premium UI, accessible primitives, lightweight animation |
| API | NestJS 11, class-validator / Zod, Swagger | Modular, testable, guard/interceptor model fits RBAC + tenancy |
| DB | PostgreSQL 16 + Prisma 6 | Relational integrity, RLS support |
| Jobs | BullMQ + Redis | Notifications, reminders, subscription expiry, retention, reconciliation |
| Auth | Firebase phone OTP → API-issued session (JWT access 15 min + rotating refresh cookie) | OTP delivery handled by Firebase; API owns roles and sessions |
| Payments | Razorpay Orders + signature check + webhooks | Required by you |
| Storage | Private bucket (S3/R2/GCS) with short-lived signed URLs | Secure documents |
| Video | Signed-playback video host (Mux / Cloudflare Stream / Bunny Stream), decided in Phase 3 | Signed, expiring HLS streams |

---

## 3. Multi-Tenant Data Isolation (3 layers)

Every institute-owned table has a non-null `instituteId`. Platform-level tables (Plan, PlatformSetting, global User identity) do not.

| Layer | Mechanism | What it stops |
| :--- | :--- | :--- |
| **1. Application** | `TenantContext` (request-scoped) is resolved from the session's *active membership*, never from a request body or query string. A Prisma Client extension **automatically adds `instituteId`** to every `where`, `create` and `upsert` on tenant models and throws if the context is missing. | Developer mistakes and forgotten filters |
| **2. Database integrity** | `@@unique([id, instituteId])` on parent tables, plus **composite foreign keys** `(childFk, instituteId) → (id, instituteId)` on key relations (enrolment→course, submission→assignment, order item→course, etc.) | Rows pointing at another institute's data |
| **3. PostgreSQL RLS** | `ENABLE ROW LEVEL SECURITY` with policy `institute_id = current_setting('app.institute_id')::uuid`. The API runs each request in a transaction with `SET LOCAL app.institute_id`. Super Admin uses a separate DB role with audited bypass. | Any leak that gets past layers 1 and 2 |

**Record-level rules on top of tenancy** (NestJS *policy* services):
- A **teacher** can only touch courses/batches they are assigned to (`CourseInstructor`, `BatchTeacher`).
- A **student** can only access their own records, plus content for courses where they hold an active, unexpired `Enrolment`.
- If a resource belongs to another tenant or the user isn't allowed to see it, the API returns **404, not 403**, so it doesn't reveal that the record exists.

Super Admin permissions use separate `platform.*` permission keys and a separate route prefix (`/api/v1/platform/*`). An Institute Admin can never hold them.

---

## 4. Authentication & Authorization

```mermaid
sequenceDiagram
    participant U as User
    participant W as Next.js
    participant F as Firebase Auth
    participant A as NestJS
    U->>W: Enter phone (+91…)
    W->>F: signInWithPhoneNumber (reCAPTCHA)
    F-->>U: SMS OTP
    U->>W: Enter OTP
    W->>F: confirm(code) → Firebase ID token
    W->>A: POST /auth/firebase {idToken}
    A->>F: verifyIdToken (firebase-admin)
    A->>A: Find User by phone → list active Memberships
    alt one membership
        A-->>W: session cookies + role → redirect to portal
    else several memberships
        A-->>W: membership picker (institute + role)
    else none
        A-->>W: "No account" / student self-registration (if enabled)
    end
```

- **Identity model:** `User` (global, unique E.164 phone) → `Membership` (user × institute × role). One person can be a teacher at Institute A and a student at Institute B.
- **Roles:** `SUPER_ADMIN`, `PLATFORM_SUPPORT`, `INSTITUTE_ADMIN`, `ACADEMIC_COORDINATOR`, `FINANCE_OFFICER`, `TEACHER`, `STUDENT`.
- **Permissions:** string keys (`students.read`, `courses.publish`, `payments.refund`…) with a default role→permission map in `packages/shared`. Institutes can override this map (`RolePermissionOverride`). Enforced by the `@RequirePermissions()` guard plus policy services.
- **Sessions:** access JWT valid for 15 minutes, held in memory or an HttpOnly cookie. The refresh token is opaque, rotated on each use and stored as a hash. If an old refresh token is reused, the whole token family is revoked. Sessions can be viewed and revoked.
- **Dev OTP provider:** for local work without Firebase, a fixed test code works **only** when `NODE_ENV !== 'production'` and `AUTH_DEV_OTP=true`. The app refuses to boot in production with this flag on.
- **Passwords:** there are none for normal users. Super Admin can optionally add TOTP 2FA in Phase 10.
- **Rate limits:** OTP verification is limited per phone, per IP and per device. Every attempt is logged in `LoginEvent`.

---

## 5. Complete Database ERD (by domain)

`PK` primary key, `FK` foreign key, `UK` unique. Every table also has `createdAt` and `updatedAt`. Tables marked † also have `deletedAt` (soft delete). Money is stored as **integer paise**.

### 5.1 Platform, Tenancy & Subscriptions

```mermaid
erDiagram
    Institute ||--|| InstituteSettings : has
    Institute ||--o{ AcademicYear : has
    Institute ||--o{ InstituteSubscription : subscribes
    Plan ||--o{ InstituteSubscription : "priced by"
    InstituteSubscription ||--o{ SubscriptionInvoice : bills
    SubscriptionInvoice ||--o{ SubscriptionPayment : "paid by"
    InstituteApplication |o--o| Institute : "becomes"

    Institute {
        uuid id PK
        string slug UK
        string name
        enum status "PENDING|ACTIVE|SUSPENDED|CLOSED"
        string timezone
        string currency
        string logoKey
        datetime deletedAt
    }
    InstituteSettings {
        uuid instituteId PK
        json branding
        json enrolmentRules
        bytes razorpayKeyEnc "AES-256-GCM"
        json notificationConfig
        bool studentSelfRegistration
    }
    AcademicYear {
        uuid id PK
        uuid instituteId FK
        string name
        date startDate
        date endDate
        bool isCurrent
    }
    InstituteApplication {
        uuid id PK
        string instituteName
        string contactName
        string phone
        string email
        enum status "SUBMITTED|APPROVED|REJECTED"
        uuid reviewedById FK
        uuid instituteId FK
    }
    Plan {
        uuid id PK
        string code UK
        string name
        int priceMonthly
        int priceYearly
        int trialDays
        int maxStudents
        int maxTeachers
        int maxCourses
        int storageGb
        json features
        bool isActive
    }
    InstituteSubscription {
        uuid id PK
        uuid instituteId FK
        uuid planId FK
        enum status "TRIALING|ACTIVE|PAST_DUE|GRACE|EXPIRED|SUSPENDED|CANCELLED"
        enum cycle "MONTHLY|YEARLY"
        datetime trialEndsAt
        datetime periodStart
        datetime periodEnd
        datetime graceEndsAt
        bool autoRenew
        datetime suspendedAt
        string suspendReason
    }
    SubscriptionInvoice {
        uuid id PK
        uuid instituteId FK
        uuid subscriptionId FK
        string number UK
        int subtotal
        int tax
        int total
        enum status "DRAFT|OPEN|PAID|VOID|OVERDUE"
        datetime dueAt
        datetime paidAt
        string pdfKey
    }
    SubscriptionPayment {
        uuid id PK
        uuid invoiceId FK
        string providerPaymentId UK
        int amount
        enum status
    }
```

### 5.2 Identity, Access & Profiles

```mermaid
erDiagram
    User ||--o{ Membership : holds
    Institute ||--o{ Membership : grants
    User ||--o{ Session : opens
    Membership ||--o| StudentProfile : "is"
    Membership ||--o| TeacherProfile : "is"
    StudentProfile ||--o{ Admission : applies
    Institute ||--o{ RolePermissionOverride : customizes
    User ||--o{ LoginEvent : logs

    User {
        uuid id PK
        string phoneE164 UK
        string firebaseUid UK
        string email
        string fullName
        string avatarKey
        enum status "ACTIVE|BLOCKED"
        datetime lastLoginAt
        datetime deletedAt
    }
    Membership {
        uuid id PK
        uuid userId FK
        uuid instituteId FK "null for platform roles"
        enum role
        enum status "INVITED|ACTIVE|SUSPENDED"
        uuid invitedById FK
    }
    Session {
        uuid id PK
        uuid userId FK
        uuid membershipId FK
        string refreshHash UK
        uuid familyId
        string ip
        string userAgent
        datetime expiresAt
        datetime revokedAt
    }
    LoginEvent {
        uuid id PK
        string phoneE164
        uuid userId FK
        string ip
        enum outcome "SUCCESS|BAD_TOKEN|NO_ACCOUNT|RATE_LIMITED"
    }
    RolePermissionOverride {
        uuid id PK
        uuid instituteId FK
        enum role
        string permission
        bool allowed
    }
    StudentProfile {
        uuid id PK
        uuid instituteId FK
        uuid membershipId FK,UK
        string admissionNo "UK per institute"
        date dob
        string gender
        json address
        json guardian
        string church
        enum status "APPLICANT|ACTIVE|INACTIVE|ALUMNI"
    }
    TeacherProfile {
        uuid id PK
        uuid instituteId FK
        uuid membershipId FK,UK
        string employeeCode
        string qualifications
        string specialization
        string bio
        string photoKey
    }
    Admission {
        uuid id PK
        uuid instituteId FK
        uuid studentProfileId FK
        enum status "APPLIED|UNDER_REVIEW|ACCEPTED|REJECTED"
        uuid decidedById FK
    }
```

### 5.3 Catalogue, Curriculum & Media

```mermaid
erDiagram
    CourseCategory ||--o{ Course : groups
    Course ||--o{ CourseInstructor : "taught by"
    TeacherProfile ||--o{ CourseInstructor : teaches
    Course ||--o{ Module : contains
    Module ||--o{ Chapter : contains
    Chapter ||--o{ Lesson : contains
    Lesson ||--o{ LessonResource : attaches
    MediaAsset ||--o{ LessonResource : "used by"
    Course ||--o| CompletionRule : "certified by"

    Course {
        uuid id PK
        uuid instituteId FK
        uuid categoryId FK
        string title
        string slug "UK per institute"
        text description
        enum level
        string language
        string thumbnailKey
        enum pricing "FREE|PAID"
        int price
        int salePrice
        enum enrolment "OPEN|APPROVAL|INVITE"
        int accessDays "null = lifetime"
        enum status "DRAFT|PUBLISHED|ARCHIVED"
        datetime deletedAt
    }
    CourseCategory {
        uuid id PK
        uuid instituteId FK
        string name
        string slug
    }
    CourseInstructor {
        uuid courseId FK
        uuid teacherProfileId FK
        uuid instituteId FK
        enum role "LEAD|ASSISTANT"
    }
    Module {
        uuid id PK
        uuid instituteId FK
        uuid courseId FK
        string title
        int position
    }
    Chapter {
        uuid id PK
        uuid instituteId FK
        uuid moduleId FK
        string title
        int position
    }
    Lesson {
        uuid id PK
        uuid instituteId FK
        uuid chapterId FK
        string title
        enum type "VIDEO|PDF|AUDIO|TEXT|QUIZ|LIVE"
        text body
        int durationSec
        bool isPreview
        bool isMandatory
        enum completion "VIEW|WATCH_90|QUIZ_PASS|MANUAL"
        int position
    }
    LessonResource {
        uuid id PK
        uuid instituteId FK
        uuid lessonId FK
        uuid mediaAssetId FK
        bool downloadable
    }
    MediaAsset {
        uuid id PK
        uuid instituteId FK
        uuid ownerUserId FK
        enum kind "VIDEO|PDF|AUDIO|IMAGE|FILE"
        string storageKey UK
        string mimeType
        bigint sizeBytes
        string sha256
        enum status "UPLOADING|SCANNING|READY|QUARANTINED"
        string videoPlaybackId
    }
    CompletionRule {
        uuid courseId PK
        uuid instituteId FK
        int minProgressPct
        bool allMandatory
        int minExamPct
        int minAttendancePct
    }
```

### 5.4 Enrolment, Batches, Live Classes & Attendance

```mermaid
erDiagram
    StudentProfile ||--o{ Enrolment : has
    Course ||--o{ Enrolment : "enrolled in"
    Batch ||--o{ Enrolment : groups
    Course ||--o{ Batch : runs
    Batch ||--o{ BatchTeacher : staffs
    Batch ||--o{ LiveSession : schedules
    LiveSession ||--o{ Attendance : records
    Enrolment ||--o{ LessonProgress : tracks
    TeacherProfile ||--o{ TeacherAttendance : logs

    Enrolment {
        uuid id PK
        uuid instituteId FK
        uuid studentProfileId FK
        uuid courseId FK
        uuid batchId FK
        enum source "PURCHASE|FREE|ADMIN|SCHOLARSHIP"
        uuid orderItemId FK,UK
        enum status "PENDING_APPROVAL|ACTIVE|SUSPENDED|EXPIRED|COMPLETED|REVOKED"
        datetime expiresAt
        int progressPct
        datetime completedAt
    }
    Batch {
        uuid id PK
        uuid instituteId FK
        uuid courseId FK
        uuid academicYearId FK
        string name
        date startDate
        date endDate
        int capacity
    }
    BatchTeacher {
        uuid batchId FK
        uuid teacherProfileId FK
        uuid instituteId FK
    }
    LessonProgress {
        uuid id PK
        uuid instituteId FK
        uuid enrolmentId FK
        uuid lessonId FK
        enum status "NOT_STARTED|IN_PROGRESS|COMPLETED"
        int lastPositionSec
        int timeSpentSec
        datetime completedAt
    }
    LiveSession {
        uuid id PK
        uuid instituteId FK
        uuid batchId FK
        uuid teacherProfileId FK
        string title
        datetime startsAt
        datetime endsAt
        enum provider "GOOGLE_MEET|MANUAL_LINK"
        string joinUrl
        string calendarEventId
        string recordingUrl
        enum status "SCHEDULED|LIVE|COMPLETED|CANCELLED"
    }
    Attendance {
        uuid id PK
        uuid instituteId FK
        uuid liveSessionId FK
        uuid studentProfileId FK
        enum status "PRESENT|LATE|ABSENT|EXCUSED"
        datetime joinedAt
        uuid markedById FK
    }
    TeacherAttendance {
        uuid id PK
        uuid instituteId FK
        uuid teacherProfileId FK
        date day
        enum status
    }
```

### 5.5 Assessments, Results & Certificates

```mermaid
erDiagram
    Course ||--o{ Assignment : sets
    Assignment ||--o{ Submission : receives
    StudentProfile ||--o{ Submission : makes
    Course ||--o{ Exam : sets
    Exam ||--o{ Question : contains
    Question ||--o{ QuestionOption : offers
    Exam ||--o{ ExamAttempt : "attempted in"
    ExamAttempt ||--o{ AttemptAnswer : contains
    Enrolment ||--o| Certificate : earns

    Assignment {
        uuid id PK
        uuid instituteId FK
        uuid courseId FK
        uuid batchId FK
        uuid createdById FK
        string title
        text instructions
        datetime dueAt
        int maxMarks
        bool allowResubmit
        int maxAttempts
        enum status "DRAFT|PUBLISHED|CLOSED"
    }
    Submission {
        uuid id PK
        uuid instituteId FK
        uuid assignmentId FK
        uuid studentProfileId FK
        int attemptNo
        text answer
        json fileAssetIds
        datetime submittedAt
        bool isLate
        int marks
        text feedback
        uuid gradedById FK
        enum status "SUBMITTED|GRADED|RETURNED"
    }
    Exam {
        uuid id PK
        uuid instituteId FK
        uuid courseId FK
        string title
        enum type "QUIZ|EXAM"
        datetime opensAt
        datetime closesAt
        int durationMin
        int totalMarks
        int passMarks
        bool shuffle
        datetime resultsPublishedAt
    }
    Question {
        uuid id PK
        uuid instituteId FK
        uuid examId FK
        enum type "MCQ_SINGLE|MCQ_MULTI|TRUE_FALSE|SHORT|DESCRIPTIVE"
        text prompt
        int marks
        int position
    }
    QuestionOption {
        uuid id PK
        uuid questionId FK
        text label
        bool isCorrect
    }
    ExamAttempt {
        uuid id PK
        uuid instituteId FK
        uuid examId FK
        uuid studentProfileId FK
        datetime startedAt
        datetime submittedAt
        int autoScore
        int manualScore
        enum status "IN_PROGRESS|SUBMITTED|GRADED"
    }
    AttemptAnswer {
        uuid id PK
        uuid attemptId FK
        uuid questionId FK
        json selectedOptionIds
        text text
        int awarded
        uuid gradedById FK
    }
    Certificate {
        uuid id PK
        uuid instituteId FK
        uuid enrolmentId FK,UK
        string certificateNo UK
        string verifyToken UK
        datetime issuedAt
        datetime revokedAt
        string pdfKey
    }
```

### 5.6 Commerce: Cart, Coupons, Orders, Payments, Refunds

```mermaid
erDiagram
    StudentProfile ||--o| Cart : owns
    Cart ||--o{ CartItem : contains
    Course ||--o{ CartItem : "added as"
    Coupon ||--o{ CouponCourse : "limited to"
    Coupon ||--o{ CouponRedemption : "redeemed in"
    StudentProfile ||--o{ Order : places
    Order ||--o{ OrderItem : contains
    Order ||--o{ Payment : "paid by"
    Order ||--o| Receipt : issues
    OrderItem ||--o| Enrolment : grants
    Payment ||--o{ Refund : "refunded by"
    Order ||--o{ FeeInstallment : "split into"

    Cart {
        uuid id PK
        uuid instituteId FK
        uuid studentProfileId FK,UK
        uuid couponId FK
    }
    CartItem {
        uuid id PK
        uuid cartId FK
        uuid courseId FK
    }
    Coupon {
        uuid id PK
        uuid instituteId FK
        string code "UK per institute"
        enum type "PERCENT|FIXED"
        int value
        int maxDiscount
        int minOrder
        enum scope "CART|COURSES"
        datetime startsAt
        datetime endsAt
        int usageLimit
        int perUserLimit
        int usedCount
        bool active
    }
    CouponRedemption {
        uuid id PK
        uuid couponId FK
        uuid orderId FK,UK
        uuid studentProfileId FK
    }
    Order {
        uuid id PK
        uuid instituteId FK
        uuid studentProfileId FK
        string number UK
        int subtotal
        int discount
        int tax
        int total
        enum status "PENDING|AWAITING_PAYMENT|PAID|FAILED|EXPIRED|REFUNDED|PART_REFUNDED"
        string idempotencyKey UK
        string providerOrderId UK
        datetime paidAt
    }
    OrderItem {
        uuid id PK
        uuid instituteId FK
        uuid orderId FK
        uuid courseId FK
        string titleSnapshot
        int listPrice
        int discount
        int finalPrice
    }
    Payment {
        uuid id PK
        uuid instituteId FK
        uuid orderId FK
        uuid installmentId FK
        enum provider "RAZORPAY|MANUAL"
        string providerPaymentId UK
        int amount
        string method
        enum status "CREATED|AUTHORIZED|CAPTURED|FAILED|REFUNDED"
        bool signatureVerified
        uuid recordedById FK
        json raw
    }
    PaymentWebhookEvent {
        uuid id PK
        string providerEventId UK
        string type
        bool signatureValid
        json payload
        datetime processedAt
        string error
    }
    Refund {
        uuid id PK
        uuid instituteId FK
        uuid paymentId FK
        int amount
        string reason
        enum status "REQUESTED|APPROVED|REJECTED|PROCESSED|FAILED"
        string providerRefundId UK
        uuid requestedById FK
        uuid approvedById FK
    }
    Receipt {
        uuid id PK
        uuid instituteId FK
        uuid orderId FK,UK
        string number UK
        string pdfKey
    }
    FeeInstallment {
        uuid id PK
        uuid instituteId FK
        uuid orderId FK
        int seq
        int amount
        datetime dueAt
        enum status "DUE|PAID|OVERDUE|WAIVED"
    }
```

### 5.7 Communication, Notifications & Support

```mermaid
erDiagram
    Announcement ||--o{ Notification : fans_out
    User ||--o{ Notification : receives
    Notification ||--o{ NotificationDelivery : "sent via"
    NotificationTemplate ||--o{ NotificationDelivery : renders
    User ||--o{ NotificationPreference : sets
    User ||--o{ DeviceToken : registers
    Thread ||--o{ ThreadParticipant : includes
    Thread ||--o{ Message : contains
    SupportTicket ||--o{ TicketMessage : contains

    Announcement {
        uuid id PK
        uuid instituteId FK
        uuid authorId FK
        enum audience "ALL|STUDENTS|TEACHERS|COURSE|BATCH"
        uuid courseId FK
        uuid batchId FK
        string title
        text body
        json channels
        datetime publishAt
    }
    Notification {
        uuid id PK
        uuid instituteId FK "nullable for platform"
        uuid userId FK
        string event
        string title
        text body
        string link
        datetime readAt
    }
    NotificationTemplate {
        uuid id PK
        uuid instituteId FK "null = platform default"
        string event
        enum channel "IN_APP|EMAIL|SMS|PUSH"
        string subject
        text body
        string dltTemplateId
    }
    NotificationPreference {
        uuid userId FK
        uuid instituteId FK
        string event
        enum channel
        bool enabled
    }
    NotificationDelivery {
        uuid id PK
        uuid notificationId FK
        uuid userId FK
        enum channel
        string provider
        string providerMessageId
        enum status "QUEUED|SENT|DELIVERED|FAILED|SUPPRESSED"
        int attempts
        string error
        string dedupeKey UK
    }
    DeviceToken {
        uuid id PK
        uuid userId FK
        string token UK
        string platform
        datetime lastSeenAt
    }
    Thread {
        uuid id PK
        uuid instituteId FK
        uuid courseId FK
        string subject
    }
    ThreadParticipant {
        uuid threadId FK
        uuid userId FK
        datetime lastReadAt
    }
    Message {
        uuid id PK
        uuid instituteId FK
        uuid threadId FK
        uuid senderId FK
        text body
    }
    SupportTicket {
        uuid id PK
        uuid instituteId FK
        enum scope "INSTITUTE|PLATFORM"
        uuid raisedById FK
        uuid assigneeId FK
        string subject
        enum priority
        enum status "OPEN|PENDING|RESOLVED|CLOSED"
    }
    TicketMessage {
        uuid id PK
        uuid ticketId FK
        uuid authorId FK
        text body
    }
```

### 5.8 Operations: Audit, Retention, Backups, Integrations

```mermaid
erDiagram
    AuditLog {
        uuid id PK
        uuid instituteId FK
        uuid actorUserId FK
        string actorRole
        string action
        string entityType
        string entityId
        json before
        json after
        string ip
        string userAgent
        string requestId
        datetime createdAt
    }
    RetentionPolicy {
        uuid id PK
        uuid instituteId FK "null = platform default"
        string entity
        int retainDays
        enum action "ANONYMIZE|DELETE|ARCHIVE"
    }
    BackupRun {
        uuid id PK
        enum kind "LOGICAL_DUMP|PITR_SNAPSHOT|PRE_MIGRATION"
        enum status "RUNNING|SUCCEEDED|FAILED"
        string location
        bigint sizeBytes
        string sha256
        datetime restoreVerifiedAt
    }
    GoogleIntegration {
        uuid id PK
        uuid instituteId FK
        uuid userId FK
        bytes refreshTokenEnc
        string scopes
    }
    PlatformSetting {
        string key PK
        json value
    }
```

---

## 6. NestJS Module Map & Dependencies

```mermaid
graph TD
    subgraph Core
        CFG[Config] --> PRISMA[Prisma + Tenancy ext]
        PRISMA --> TEN[Tenancy]
        AUTH[Auth / Sessions] --> TEN
        RBAC[RBAC + Policies] --> AUTH
        AUDIT[Audit] --> PRISMA
        QUEUE[Queue / BullMQ]
        STORAGE[Storage / Signed URLs]
    end
    INST[Institutes & Settings] --> RBAC
    USERS[Users & Memberships] --> RBAC
    STU[Students & Admissions] --> USERS
    TCH[Teachers] --> USERS
    CAT[Courses & Categories] --> TCH
    CUR[Curriculum] --> CAT
    MEDIA[Media] --> STORAGE
    CUR --> MEDIA
    ENR[Enrolments & Progress] --> CUR
    ENR --> STU
    BATCH[Batches] --> CAT
    LIVE[Live Classes / Meet] --> BATCH
    ATT[Attendance] --> LIVE
    ASG[Assignments] --> ENR
    EXAM[Exams & Results] --> ENR
    CERT[Certificates] --> EXAM
    CERT --> ATT
    COM[Commerce: Cart, Coupons, Orders] --> CAT
    PAY[Payments / Razorpay / Refunds] --> COM
    PAY --> ENR
    NOTIF[Notifications] --> QUEUE
    ANN[Announcements & Messaging] --> NOTIF
    SUP[Support Tickets] --> NOTIF
    REP[Reports] --> ENR
    REP --> PAY
    SUB[Subscriptions & Plans] --> INST
    SUB --> NOTIF
    PLAT[Platform / Super Admin] --> SUB
    RET[Retention & Backup jobs] --> QUEUE
    ALL((every domain module)) -.-> AUDIT
```

Every module that changes data writes to `AuditLog` through an interceptor, using a declarative `@Audit('course.publish')` decorator.

---

## 7. Course Purchasing (cart → verified enrolment)

```mermaid
sequenceDiagram
    participant S as Student
    participant A as NestJS
    participant R as Razorpay
    S->>A: Add courses to cart, apply coupon
    A->>A: Re-price server-side (sale price, coupon rules, limits)
    S->>A: POST /checkout (Idempotency-Key)
    A->>A: Create Order + OrderItems (price snapshots)
    alt total == 0 (free / 100% coupon)
        A->>A: Mark PAID, create Enrolments in one transaction
    else paid
        A->>R: Create Razorpay order (amount from DB)
        A-->>S: providerOrderId + public key id
        S->>R: Razorpay Checkout
        R-->>S: payment_id + signature
        S->>A: POST /payments/verify
        A->>A: HMAC-SHA256 verify → mark AUTHORIZED/CAPTURED
        R->>A: Webhook payment.captured (signature verified)
        A->>A: Idempotent: unique providerPaymentId / eventId
        A->>A: Order PAID → Enrolments + Receipt + notification
    end
```

- **Prices are never taken from the client.** The server re-prices the cart at checkout, and that price is what goes into the order.
- An enrolment is created **only** after the server has verified the payment signature or the webhook signature. The webhook is the source of truth. A reconciliation job pulls stuck `AWAITING_PAYMENT` orders from Razorpay every 15 minutes.
- Idempotency is enforced in several places: `Order.idempotencyKey`, `Payment.providerPaymentId`, `PaymentWebhookEvent.providerEventId` and `Enrolment.orderItemId` are all unique.
- **Coupon redemption** happens inside the same transaction that marks the order PAID. Usage limits are checked with a row lock, so a coupon can't be over-used under concurrent checkouts.
- **Refunds:** student requests → admin approves → Razorpay refund API → `refund.processed` webhook → enrolment revoked (configurable) → audit entry.
- **Partial payments:** `FeeInstallment` schedule. Access rules (for example, access while installments are not overdue) are configured per course.
- Secret keys stay in the backend only. Per-institute keys are encrypted at rest with AES-256-GCM, using a key from env/KMS.

---

## 8. Subscription Lifecycle (Super Admin)

```mermaid
stateDiagram-v2
    [*] --> TRIALING: institute approved
    TRIALING --> ACTIVE: paid before trial end
    TRIALING --> EXPIRED: trial ended, unpaid
    ACTIVE --> PAST_DUE: renewal invoice unpaid at period end
    PAST_DUE --> ACTIVE: paid
    PAST_DUE --> GRACE: after N days
    GRACE --> ACTIVE: paid
    GRACE --> SUSPENDED: grace ended
    ACTIVE --> SUSPENDED: manual (Super Admin, reason required)
    SUSPENDED --> ACTIVE: reinstated / paid
    EXPIRED --> ACTIVE: paid
    ACTIVE --> CANCELLED: cancel at period end
```

- **Daily jobs:** issue renewal invoices 7 days before period end, send reminders at 7, 3 and 1 days and on the expiry day, move statuses forward, and enforce suspension.
- **Effect of suspension:** institute users get read-only access with a banner, and new enrolments and payments are blocked. Students keep read access to content they already paid for during GRACE. **No data is ever deleted when an institute is suspended.**
- **Plan limits** (students, teachers, courses, storage) are enforced in the API through a `PlanLimitGuard`.
- Invoices get sequential numbers per financial year, with PDF and GST fields.

---

## 9. Secure Video & Document Access

1. All files live in a **private** bucket. Nothing is publicly readable.
2. **Uploads:** API checks permission → issues a presigned PUT (content type and size limits) → client uploads → API verifies size, MIME and magic bytes (optional ClamAV scan) → `READY`.
3. **Access:** `GET /lessons/:id/content` → policy check (active, unexpired enrolment, or preview lesson, or assigned teacher) → signed URL valid for about 5 minutes and tied to the asset.
4. **Video:** HLS through a provider that supports signed playback tokens (short TTL) and domain restriction, plus a dynamic watermark overlay showing the student's name and masked phone.
5. **PDFs:** shown in an in-app pdf.js viewer. Download is offered only when `LessonResource.downloadable` is set.

> [!WARNING]
> No web solution can fully stop screen recording. Signed URLs and watermarks make casual sharing hard and help trace leaks. Full DRM (Widevine/FairPlay) can be added later if you need it, at extra cost.

---

## 10. Notification Pipeline

`Domain event → NotificationService.dispatch(event, recipients, data)` → writes in-app `Notification` rows → checks each user's `NotificationPreference` → queues one BullMQ job per channel → channel workers (Email / SMS / Push) → `NotificationDelivery` row with status and retries (exponential backoff, dead-letter queue).

| Channel | Provider (proposed) | Notes |
| :--- | :--- | :--- |
| In-app | DB + Server-Sent Events | Bell icon, unread count, mark all read |
| Email | Resend / Amazon SES | Templated, with unsubscribe link for non-transactional mail |
| SMS / OTP | OTP through Firebase Auth. Transactional SMS through MSG91 / Twilio | **India requires DLT registration** of sender ID and templates |
| Push | Firebase Cloud Messaging (web push) | Works where the browser supports it. Not available on iOS Safari unless the app is installed as a PWA |

Events include: OTP login, enrolment confirmed, payment success/failure, refund status, class reminder (24 h / 15 min), assignment due/graded, results published, certificate issued, announcement, subscription reminders/suspension.

---

## 11. Backup, Recovery, Audit & Retention

| Area | Policy |
| :--- | :--- |
| **Backups** | Managed Postgres with point-in-time recovery (7–30 days, depending on provider). Plus a nightly encrypted `pg_dump` to a separate bucket/account, kept 30 daily and 12 monthly. Every run is recorded in `BackupRun`. |
| **Pre-migration** | Mandatory snapshot before `prisma migrate deploy` in staging/production. Migrations are reviewed and must be additive. Destructive steps are split out and **need your explicit approval**. |
| **Recovery** | Written runbook with target RPO ≤ 15 min and RTO ≤ 4 h. A **monthly restore drill** into a scratch database is recorded in `restoreVerifiedAt`. |
| **Audit logs** | Append-only. The app's DB role has `UPDATE`/`DELETE` revoked on `audit_log`. Covers logins, role changes, grade changes, payments, refunds, settings, exports and suspensions. |
| **Soft delete** | All user-facing domain records use `deletedAt`. Hard deletion happens only through retention jobs. |
| **Retention** (defaults, configurable) | OTP/login events 180 days; notifications 1 year; audit logs 7 years; financial records kept for the statutory period (**confirm with your accountant**); inactive student PII anonymized on approved erasure requests while financial rows are kept. |
| **Privacy** | Personal data export and erasure workflow, aligned with India's DPDP Act 2023. |

---

## 12. Testing Strategy

| Level | Tooling | Scope |
| :--- | :--- | :--- |
| Unit | Jest | Services: pricing/coupons, subscription state machine, grading, completion rules, permission resolution |
| Integration (DB) | Jest + real Postgres (CI service container, or a dedicated local test DB) | Repositories, Prisma tenancy extension, RLS policies, transactions, idempotency, migrations applied to an empty DB |
| API e2e | Supertest against the Nest app | Every endpoint: success, validation errors, 401/403/404 |
| **Permission matrix** | Generated table-driven tests | For **each endpoint × each role** → expected allow/deny, from one shared matrix file |
| **Tenant isolation** | Dedicated suite | Institute A users try to read/write B's records by ID, list, search and export → must get 404 / empty results |
| Payments | Razorpay test mode + signed webhook fixtures | Duplicate webhooks, bad signatures, amount tampering, out-of-order events |
| Web | Vitest + React Testing Library | Components, forms, hooks |
| Portal e2e | Playwright | Key journeys per portal, desktop + mobile viewports, axe accessibility checks |
| Performance | Lighthouse CI, k6 (Phase 10) | Budgets: LCP < 2.5 s, API p95 < 300 ms on core reads |

**Exit criteria for every phase:** lint, typecheck, unit, integration and e2e all pass. Both apps build. The permission matrix and tenant suites are green. Responsive screens are checked. `IMPLEMENTATION_PROGRESS.md` is updated.

---

## 13. Phase-wise Execution Checklist

### Phase 1 — Foundation
- [ ] Monorepo (npm workspaces), shared ESLint/Prettier/TS config, `.env.example` files
- [ ] NestJS core: Config (validated env), Prisma service + tenancy extension, request context, logging (pino + request IDs), throttling, global validation, error filter, health check, Swagger
- [ ] Full Prisma schema (§5) + first migration (on an empty DB, after you approve the DB) + RLS SQL migration
- [ ] Seed: 1 platform super admin, 1 demo institute, roles, the prototype's courses/teachers/students
- [ ] Auth: Firebase token exchange, dev OTP provider, memberships, membership picker, refresh rotation, logout, `/me`
- [ ] RBAC: permission catalogue, `@RequirePermissions`, policy base classes, audit interceptor
- [ ] Next.js: design tokens, light/dark themes, UI kit (Button, Input, Select, Dialog, Drawer, Tabs, Table, Badge, Card, StatCard, Avatar, Skeleton, EmptyState, Toast, Dropdown, ProgressRing, Chart wrappers), motion presets that respect reduced motion
- [ ] Login (phone → OTP → picker), role routing, 4 portal shells (sidebars, topbar, user menu, collapsible nav, mobile drawer)
- [ ] Tests: auth e2e, tenancy extension, permission-matrix harness. CI workflow
- [ ] Docs: ARCHITECTURE, DATABASE_SAFETY, IMPLEMENTATION_PROGRESS

### Phase 2 — Institute Admin core
- [ ] Dashboard KPIs, charts, recent activity, upcoming classes, quick actions
- [ ] Students: CRUD, admissions pipeline, profile with tabs (academics, enrolments, fees, attendance), search/filter/pagination, CSV import/export
- [ ] Teachers: CRUD, profile, course/batch assignment, workload, teacher attendance
- [ ] Academic years, institute profile/branding, role-permission overrides, in-app notification centre (basic)

### Phase 3 — Courses, Curriculum & Secure Media
- [ ] Categories, course editor (thumbnail, pricing FREE/PAID/sale, enrolment mode, access duration), publish/archive, instructors
- [ ] Curriculum builder Course→Module→Chapter→Lesson→Resource with drag-and-drop reorder
- [ ] Media pipeline: presigned uploads, validation, video provider integration, signed delivery, watermark
- [ ] Completion rules

### Phase 4 — Teacher Portal
- [ ] Dashboard, assigned courses/batches, rosters, content editing within permissions, material upload, announcements, student performance view

### Phase 5 — Student Portal
- [ ] Dashboard (welcome, progress, hours, streak, upcoming classes, pending work, announcements, certificates)
- [ ] In-app course catalogue, course detail, **cart**, free-course enrolment
- [ ] Course player (video/PDF/audio/text, resume position, mark complete, next lesson), progress tracking

### Phase 6 — Assignments, Exams & Results
- [ ] Assignments with attachments, submissions, late flag, resubmission, grading workbench, feedback
- [ ] Exam builder (MCQ/TF/short/descriptive), scheduling, timer, autosave, auto-grading, manual grading, result publishing, analytics

### Phase 7 — Live Classes, Attendance & Communication
- [ ] Google Meet via Calendar API (teacher OAuth), manual-link fallback, reminders, class history, recordings
- [ ] Attendance (bulk mark, join tracking, reports)
- [ ] Full notification pipeline: email, SMS (DLT), web push, preferences, templates. Messaging threads. Support tickets

### Phase 8 — Commerce, Certificates & Finance
- [ ] Multi-course checkout, discounts, coupons, Razorpay orders/verify/webhooks/reconciliation, receipts, installments, manual offline payments, refunds
- [ ] Certificate eligibility engine, PDF generation, unique IDs, `/verify/:token` page, revocation
- [ ] Financial and academic reports with exports

### Phase 9 — Super Admin & Subscriptions
- [ ] Platform dashboard, institute applications (approve/reject), institute profiles, activate/suspend
- [ ] Plans/packages, trials, renewals, expiry, grace, invoices, platform payments, plan-limit enforcement
- [ ] Platform support desk, platform settings, platform audit viewer

### Phase 10 — Hardening & Deployment
- [ ] Security review (OWASP ASVS L2 checklist), Super Admin 2FA, dependency audit, CSP/headers
- [ ] Performance (query indexes, caching, image optimization, bundle analysis), k6 load test
- [ ] Backup automation + restore drill, retention jobs, monitoring/alerts (Sentry, uptime)
- [ ] Staging → production deployment (Vercel + API host + managed Postgres + Redis), runbooks

### Phase 11 — Public Website ⏸ POSTPONED
- Not started until Phases 1–10 are approved.

---

## 14. Decisions Needed From You

| # | Decision | Default if you don't mind |
| :--- | :--- | :--- |
| 1 | **Development database:** no local Postgres/Docker found | Free managed Postgres (Neon or Supabase, Mumbai region). You create it and paste the connection string into `.env` |
| 2 | **Firebase project** for phone OTP | Build with the dev OTP provider now, then plug Firebase in when you share config |
| 3 | **Tailwind version** | Tailwind CSS v4 (current default) |
| 4 | **Student self-registration** by phone | Allowed (needed for purchases). Teachers/admins are invite-only |
| 5 | Payment collection model (Phase 8) | Each institute connects its own Razorpay account. Platform subscriptions use the platform account |
| 6 | Video host (Phase 3) | Decide in Phase 3 after comparing cost |
