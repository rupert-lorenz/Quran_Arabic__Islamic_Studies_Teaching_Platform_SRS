import Link from "next/link";
import { AcademicWorkspace } from "@/components/staff/academic-workspace";
import { GamesDesk } from "@/components/lms/games-desk";
import { HomeworkDesk } from "@/components/lms/homework-desk";
import { QuestionBankDesk } from "@/components/lms/question-bank-desk";
import { ExamDesk } from "@/components/lms/exam-desk";
import { MarkingDesk } from "@/components/lms/marking-desk";
import { QuizDesk } from "@/components/lms/quiz-desk";
import { LibraryDownloadsPanel } from "@/components/lms/library-downloads-panel";
import { LibraryExpiryPanel } from "@/components/lms/library-expiry-panel";
import { LibraryPrerecordedPanel } from "@/components/lms/library-prerecorded-panel";
import { LibraryLicencesPanel } from "@/components/lms/library-licences-panel";
import { LibraryPurchasesPanel } from "@/components/lms/library-purchases-panel";
import { LibraryRentalsPanel } from "@/components/lms/library-rentals-panel";
import { MonthlySubscriptionsFacultyView } from "@/components/finance/monthly-subscriptions-faculty";
import { LibrarySubscriptionsPanel } from "@/components/lms/library-subscriptions-panel";
import { TeachingMaterialLibrary } from "@/components/lms/teaching-material-library";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { listTeachingLibrary } from "@/server/lms/library";
import { listLibraryDownloadDesk } from "@/server/lms/downloads";
import { listLibraryExpiryDesk } from "@/server/lms/expiry";
import { listGamesDesk } from "@/server/lms/games";
import { listHomeworkDesk } from "@/server/lms/homework";
import { listQuestionBankDesk } from "@/server/lms/question-bank";
import { listExamsDesk } from "@/server/lms/exams";
import { listMarkingDesk } from "@/server/lms/marking";
import { listQuizzesDesk } from "@/server/lms/quizzes";
import { listLibraryPrerecordedDesk } from "@/server/lms/prerecorded-courses";
import { listLibraryLicenceDesk } from "@/server/lms/licences";
import { listLibraryPurchaseDesk } from "@/server/lms/purchases";
import { listLibraryRentalDesk } from "@/server/lms/rentals";
import { getMonthlySubscriptionsFaculty } from "@/server/finance/monthly-subscriptions";
import { listLibrarySubscriptionDesk } from "@/server/lms/subscriptions";
import { requireStaffPage } from "@/server/rbac/guard";
import { listAcademicWorkspace } from "@/server/staff/academic";

export const metadata = {
  title: "Academic",
};

export default async function StaffAcademicPage() {
  const access = await requireStaffPage([
    "academic.curriculum",
    "academic.certificates",
    "reports.academic",
  ]);
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const canCurriculum = hasAnyPermission(access, "academic.curriculum");
  const [workspace, library, licences, rentals, subscriptions, monthly, purchases, expiry, downloads, courses, homework, games, quizDesk, examDesk, marking, bank] = await Promise.all([
    listAcademicWorkspace(),
    listTeachingLibrary(actor),
    canCurriculum ? listLibraryLicenceDesk(actor) : Promise.resolve(null),
    canCurriculum ? listLibraryRentalDesk(actor) : Promise.resolve(null),
    canCurriculum ? listLibrarySubscriptionDesk(actor) : Promise.resolve(null),
    canCurriculum ? getMonthlySubscriptionsFaculty(actor) : Promise.resolve(null),
    canCurriculum ? listLibraryPurchaseDesk(actor) : Promise.resolve(null),
    canCurriculum ? listLibraryExpiryDesk(actor) : Promise.resolve(null),
    canCurriculum ? listLibraryDownloadDesk(actor) : Promise.resolve(null),
    canCurriculum ? listLibraryPrerecordedDesk(actor) : Promise.resolve(null),
    canCurriculum ? listHomeworkDesk(actor) : Promise.resolve(null),
    canCurriculum ? listGamesDesk(actor) : Promise.resolve(null),
    canCurriculum ? listQuizzesDesk(actor) : Promise.resolve(null),
    canCurriculum ? listExamsDesk(actor) : Promise.resolve(null),
    canCurriculum ? listMarkingDesk(actor) : Promise.resolve(null),
    canCurriculum ? listQuestionBankDesk(actor) : Promise.resolve(null),
  ]);

  return (
    <Container className="py-10">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-brand">
        Academic
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Curriculum, teaching material library, question bank, quizzes, exams, marking, student reports, certificates, rewards, attendance, login and lesson times, Islamic education progress, Qur&apos;an and Hifdh tracking, AI Systems with teacher review before publish, interactive games, homework, prerecorded courses,
        subscriptions, purchases, content licences, rentals, expiry dates,
        restricted downloads, and certificate templates. Enabled subjects
        appear on the public catalogue.
      </p>
      <div className="mt-8 space-y-8">
        {canCurriculum ||
        hasAnyPermission(access, "reports.academic") ||
        hasAnyPermission(access, "academic.certificates") ? (
          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              Student reports
            </h2>
            <p className="mt-2 text-sm text-muted">
              Quiz, exam, homework, game, course, and lesson results for each student.
            </p>
            <p className="mt-4 text-sm font-semibold">
              <Link href="/staff/academic/reports" className="text-brand underline">
                Open student reports
              </Link>
              {" · "}
              <Link href="/staff/academic/certificates" className="text-brand underline">
                Open certificates
              </Link>
              {" · "}
              <Link href="/staff/academic/rewards" className="text-brand underline">
                Open rewards
              </Link>
              {" · "}
              <Link href="/staff/academic/attendance" className="text-brand underline">
                Open attendance
              </Link>
              {" · "}
              <Link href="/staff/academic/activity" className="text-brand underline">
                Open login and lesson times
              </Link>
              {" · "}
              <Link href="/staff/academic/progress" className="text-brand underline">
                Open Islamic education progress
              </Link>
              {" · "}
              <Link href="/staff/academic/quran" className="text-brand underline">
                Open Qur&apos;an and Hifdh
              </Link>
              {" · "}
              <Link href="/staff/academic/arabic" className="text-brand underline">
                Open Arabic language
              </Link>
              {" · "}
              <Link href="/staff/academic/islamic-studies" className="text-brand underline">
                Open Islamic Studies
              </Link>
              {" · "}
              <Link href="/staff/academic/ai" className="text-brand underline">
                Open AI Systems
              </Link>
            </p>
          </section>
        ) : null}
        {bank ? <QuestionBankDesk initial={bank} /> : null}
        {marking ? <MarkingDesk initial={marking} /> : null}
        {examDesk ? <ExamDesk initial={examDesk} /> : null}
        {quizDesk ? <QuizDesk initial={quizDesk} /> : null}
        {games ? <GamesDesk initial={games} /> : null}
        {homework ? <HomeworkDesk initial={homework} /> : null}
        {courses ? <LibraryPrerecordedPanel initial={courses} /> : null}
        {downloads ? <LibraryDownloadsPanel initial={downloads} /> : null}
        {expiry ? <LibraryExpiryPanel initial={expiry} /> : null}
        {monthly ? <MonthlySubscriptionsFacultyView faculty={monthly} /> : null}
        {subscriptions ? <LibrarySubscriptionsPanel initial={subscriptions} /> : null}
        {purchases ? <LibraryPurchasesPanel initial={purchases} /> : null}
        {licences ? <LibraryLicencesPanel initial={licences} /> : null}
        {rentals ? <LibraryRentalsPanel initial={rentals} /> : null}
        <TeachingMaterialLibrary
          materials={library.materials}
          subjects={library.subjects}
          catalog={library.catalog}
          licences={library.licences}
          rentals={library.rentals}
          subscriptions={library.subscriptions}
          purchases={library.purchases}
          courses={library.courses}
          canUpload={canCurriculum}
          canManage={canCurriculum}
        />
        <AcademicWorkspace
          initial={workspace}
          canCurriculum={canCurriculum}
          canCertificates={hasAnyPermission(access, "academic.certificates")}
          canReport={hasAnyPermission(access, "reports.academic")}
        />
      </div>
    </Container>
  );
}
