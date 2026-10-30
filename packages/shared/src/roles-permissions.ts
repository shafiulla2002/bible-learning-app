export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_SUPPORT: 'PLATFORM_SUPPORT',
  INSTITUTE_ADMIN: 'INSTITUTE_ADMIN',
  ACADEMIC_COORDINATOR: 'ACADEMIC_COORDINATOR',
  FINANCE_OFFICER: 'FINANCE_OFFICER',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export const ROLE_PORTAL_MAP: Record<RoleType, string> = {
  SUPER_ADMIN: '/super-admin',
  PLATFORM_SUPPORT: '/super-admin',
  INSTITUTE_ADMIN: '/admin',
  ACADEMIC_COORDINATOR: '/admin',
  FINANCE_OFFICER: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
};

export const Permission = {
  // Platform
  PLATFORM_MANAGE_INSTITUTES: 'platform.manage_institutes',
  PLATFORM_MANAGE_PLANS: 'platform.manage_plans',
  PLATFORM_VIEW_METRICS: 'platform.view_metrics',

  // Institute settings
  INSTITUTE_SETTINGS_MANAGE: 'institute.settings.manage',
  INSTITUTE_FACULTY_MANAGE: 'institute.faculty.manage',
  INSTITUTE_STUDENTS_MANAGE: 'institute.students.manage',

  // Academics
  COURSES_CREATE: 'courses.create',
  COURSES_EDIT: 'courses.edit',
  COURSES_PUBLISH: 'courses.publish',
  COURSES_VIEW: 'courses.view',
  CURRICULUM_MANAGE: 'curriculum.manage',

  // Batches & Live Sessions
  BATCHES_MANAGE: 'batches.manage',
  LIVE_SESSIONS_HOST: 'live_sessions.host',
  LIVE_SESSIONS_JOIN: 'live_sessions.join',
  ATTENDANCE_MARK: 'attendance.mark',
  ATTENDANCE_VIEW: 'attendance.view',

  // Assignments & Exams
  ASSIGNMENTS_MANAGE: 'assignments.manage',
  ASSIGNMENTS_SUBMIT: 'assignments.submit',
  ASSIGNMENTS_GRADE: 'assignments.grade',
  EXAMS_MANAGE: 'exams.manage',
  EXAMS_ATTEMPT: 'exams.attempt',
  EXAMS_GRADE: 'exams.grade',

  // Certificates
  CERTIFICATES_ISSUE: 'certificates.issue',
  CERTIFICATES_REVOKE: 'certificates.revoke',
  CERTIFICATES_VIEW_OWN: 'certificates.view_own',

  // Commerce & Finance
  ORDERS_VIEW: 'orders.view',
  ORDERS_MANAGE: 'orders.manage',
  COUPONS_MANAGE: 'coupons.manage',
  PAYMENTS_REFUND: 'payments.refund',
  RECEIPTS_VIEW_OWN: 'receipts.view_own',
  COURSE_PURCHASE: 'course.purchase',

  // Communication
  ANNOUNCEMENTS_CREATE: 'announcements.create',
  ANNOUNCEMENTS_VIEW: 'announcements.view',
  TICKETS_MANAGE: 'tickets.manage',
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleType, PermissionType[]> = {
  SUPER_ADMIN: Object.values(Permission),
  PLATFORM_SUPPORT: [
    Permission.PLATFORM_VIEW_METRICS,
    Permission.COURSES_VIEW,
    Permission.TICKETS_MANAGE,
  ],
  INSTITUTE_ADMIN: [
    Permission.INSTITUTE_SETTINGS_MANAGE,
    Permission.INSTITUTE_FACULTY_MANAGE,
    Permission.INSTITUTE_STUDENTS_MANAGE,
    Permission.COURSES_CREATE,
    Permission.COURSES_EDIT,
    Permission.COURSES_PUBLISH,
    Permission.COURSES_VIEW,
    Permission.CURRICULUM_MANAGE,
    Permission.BATCHES_MANAGE,
    Permission.LIVE_SESSIONS_HOST,
    Permission.LIVE_SESSIONS_JOIN,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_VIEW,
    Permission.ASSIGNMENTS_MANAGE,
    Permission.ASSIGNMENTS_GRADE,
    Permission.EXAMS_MANAGE,
    Permission.EXAMS_GRADE,
    Permission.CERTIFICATES_ISSUE,
    Permission.CERTIFICATES_REVOKE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_MANAGE,
    Permission.COUPONS_MANAGE,
    Permission.PAYMENTS_REFUND,
    Permission.ANNOUNCEMENTS_CREATE,
    Permission.ANNOUNCEMENTS_VIEW,
    Permission.TICKETS_MANAGE,
  ],
  ACADEMIC_COORDINATOR: [
    Permission.INSTITUTE_STUDENTS_MANAGE,
    Permission.COURSES_CREATE,
    Permission.COURSES_EDIT,
    Permission.COURSES_VIEW,
    Permission.CURRICULUM_MANAGE,
    Permission.BATCHES_MANAGE,
    Permission.LIVE_SESSIONS_HOST,
    Permission.LIVE_SESSIONS_JOIN,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_VIEW,
    Permission.ASSIGNMENTS_MANAGE,
    Permission.ASSIGNMENTS_GRADE,
    Permission.EXAMS_MANAGE,
    Permission.EXAMS_GRADE,
    Permission.CERTIFICATES_ISSUE,
    Permission.ANNOUNCEMENTS_CREATE,
    Permission.ANNOUNCEMENTS_VIEW,
  ],
  FINANCE_OFFICER: [
    Permission.ORDERS_VIEW,
    Permission.ORDERS_MANAGE,
    Permission.COUPONS_MANAGE,
    Permission.PAYMENTS_REFUND,
    Permission.INSTITUTE_STUDENTS_MANAGE,
    Permission.COURSES_VIEW,
  ],
  TEACHER: [
    Permission.COURSES_VIEW,
    Permission.LIVE_SESSIONS_HOST,
    Permission.LIVE_SESSIONS_JOIN,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_VIEW,
    Permission.ASSIGNMENTS_MANAGE,
    Permission.ASSIGNMENTS_GRADE,
    Permission.EXAMS_GRADE,
    Permission.ANNOUNCEMENTS_CREATE,
    Permission.ANNOUNCEMENTS_VIEW,
  ],
  STUDENT: [
    Permission.COURSES_VIEW,
    Permission.COURSE_PURCHASE,
    Permission.LIVE_SESSIONS_JOIN,
    Permission.ATTENDANCE_VIEW,
    Permission.ASSIGNMENTS_SUBMIT,
    Permission.EXAMS_ATTEMPT,
    Permission.CERTIFICATES_VIEW_OWN,
    Permission.RECEIPTS_VIEW_OWN,
    Permission.ANNOUNCEMENTS_VIEW,
  ],
};
