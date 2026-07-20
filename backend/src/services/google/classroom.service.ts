import { getGoogleClients } from '../../config/google';

export async function getClassroomCourses(accessToken: string, refreshToken?: string): Promise<any[]> {
  const { classroom } = getGoogleClients(accessToken, refreshToken);
  const res = await classroom.courses.list({ courseStates: ['ACTIVE'] });
  return res.data.courses || [];
}

export async function getClassroomStudents(courseId: string, accessToken: string, refreshToken?: string): Promise<any[]> {
  const { classroom } = getGoogleClients(accessToken, refreshToken);
  const res = await classroom.courses.students.list({ courseId });
  const students = res.data.students || [];

  // For students where emailAddress wasn't returned by the roster call (common for
  // personal-Gmail classrooms), fetch their profile individually using userProfiles.get.
  // This requires the classroom.profile.emails scope granted during OAuth.
  const enriched = await Promise.all(
    students.map(async (student) => {
      if (student.profile?.emailAddress) return student;   // already have it

      const userId = student.userId || student.profile?.id;
      if (!userId) return student;

      try {
        const profileRes = await classroom.userProfiles.get({ userId });
        const email = profileRes.data.emailAddress;
        if (email) {
          return {
            ...student,
            profile: {
              ...student.profile,
              emailAddress: email,
            },
          };
        }
      } catch (_) {
        // Profile lookup not permitted or user not found — return as-is
      }

      return student;
    })
  );

  return enriched;
}

// Legacy default export for backward compatibility with dashboard.routes.ts
const GoogleClassroomService = {
  async getStudentAssignments(_userId: string): Promise<any[]> {
    return [];
  },
  async syncTeacherCourses(_userId: string, _accessToken: string, _refreshToken: string): Promise<void> {
    // No-op — use the classroom routes instead
  }
};

export default GoogleClassroomService;
