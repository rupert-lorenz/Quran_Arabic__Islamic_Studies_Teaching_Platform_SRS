import { IntroVideoPlayer } from "@/components/teachers/intro-video-player";
import { TeacherPortrait } from "@/components/teachers/teacher-portrait";
import { ButtonLink } from "@/components/ui/button";

export function FeaturedTeacherShowcase({
  teacher,
  watchLabel,
  profileLabel,
}: {
  teacher: {
    userId?: string;
    href?: string;
    displayName: string;
    headline?: string | null;
    subjects: string;
    photoUrl?: string | null;
    video?: {
      watchUrl: string;
      playback?: {
        provider: "youtube" | "vimeo" | "file";
        watchUrl: string;
        embedUrl: string | null;
        thumbnailUrl: string | null;
      } | null;
    } | null;
  };
  watchLabel: string;
  profileLabel: string;
}) {
  const href = teacher.href ?? (teacher.userId ? `/teachers/${teacher.userId}` : "/teachers");

  return (
    <article className="overflow-hidden rounded-[2rem] bg-brand text-white shadow-[var(--shadow-card)]">
      {teacher.video ? (
        <IntroVideoPlayer
          playback={teacher.video.playback}
          url={teacher.video.watchUrl}
          title={`${teacher.displayName} introduction`}
        />
      ) : (
        <div className="aspect-video overflow-hidden">
          <TeacherPortrait
            name={teacher.displayName}
            src={teacher.photoUrl}
            size="hero"
            className="h-full w-full rounded-none"
          />
        </div>
      )}
      <div className="p-6">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-accent">
          {teacher.subjects}
        </p>
        <h3 className="mt-2 text-2xl font-extrabold">{teacher.displayName}</h3>
        {teacher.headline ? (
          <p className="mt-2 text-sm leading-6 text-white/80">{teacher.headline}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={href} className="w-full sm:w-auto">
            {teacher.video ? watchLabel : profileLabel}
          </ButtonLink>
          {teacher.video ? (
            <ButtonLink href={href} variant="secondary" className="w-full sm:w-auto">
              {profileLabel}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}
