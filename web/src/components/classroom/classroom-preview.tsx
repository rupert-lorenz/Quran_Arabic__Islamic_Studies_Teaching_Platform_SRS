import { ClassroomOverlay } from "@/components/classroom/classroom-overlay";
import type { BrandProfile } from "@/lib/brand";
import type { ClassroomOverlay as Overlay } from "@/lib/classroom-brand";

export function ClassroomPreview({
  brand,
  overlay,
  title,
  body,
  teacherLabel,
  studentLabel,
  studentTwoLabel,
  boardLabel,
  cameraLabel,
  micLabel,
  shareLabel,
  chatLabel,
  chatSample,
  timerLabel,
  recordingLabel,
  recordingSecureLabel,
  filesLabel,
  filesSample,
  slidesLabel,
  slidesSample,
  bookLabel,
  bookSample,
  readerSample,
  boardTools,
}: {
  brand: BrandProfile;
  overlay: Overlay;
  title: string;
  body: string;
  teacherLabel: string;
  studentLabel: string;
  studentTwoLabel: string;
  boardLabel: string;
  cameraLabel: string;
  micLabel: string;
  shareLabel: string;
  chatLabel: string;
  chatSample: string;
  timerLabel: string;
  recordingLabel?: string;
  recordingSecureLabel?: string;
  filesLabel: string;
  filesSample: string;
  slidesLabel: string;
  slidesSample: string;
  bookLabel: string;
  bookSample: string;
  readerSample: string;
  boardTools: string;
}) {
  const tiles = [
    { label: teacherLabel, featured: true, sharing: true },
    { label: studentLabel, featured: false, sharing: false },
    { label: studentTwoLabel, featured: false, sharing: false },
  ];

  return (
    <article
      className="overflow-hidden rounded-[2rem] border border-line shadow-[var(--shadow-card)]"
      style={{ background: overlay.primaryColor }}
    >
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <ClassroomOverlay brand={brand} overlay={overlay} placement="bar" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {recordingLabel ? (
            <span className="rounded-full bg-rose px-3 py-1 text-[0.65rem] font-extrabold uppercase text-brand">
              {recordingLabel}
              {recordingSecureLabel ? ` · ${recordingSecureLabel}` : ""}
            </span>
          ) : null}
          <span className="rounded-full bg-black/25 px-3 py-1 text-[0.65rem] font-extrabold text-white">
            {timerLabel}
          </span>
        </div>
      </div>
      <div className="rounded-t-[1.5rem] bg-[color:var(--color-background,#f3f4f2)] p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-brand-soft">
          {title}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-brand">
          {body.replace("{name}", brand.name)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className={`relative overflow-hidden rounded-2xl ${
                tile.featured ? "col-span-2" : ""
              }`}
              style={{ background: overlay.primaryColor }}
            >
              <div className="aspect-video" />
              <ClassroomOverlay brand={brand} overlay={overlay} placement="corner" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-2 pt-8">
                <p className="text-xs font-bold text-white">{tile.label}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-extrabold text-white">
                    {cameraLabel}
                  </span>
                  <span className="rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-extrabold text-white">
                    {micLabel}
                  </span>
                  {tile.sharing ? (
                    <span className="rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-extrabold text-white">
                      {shareLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface px-4 py-6">
          <p className="text-xs font-extrabold uppercase text-brand-soft">
            {boardLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {boardTools.split("·").map((tool) => (
              <span
                key={tool}
                className="rounded-full bg-background px-2 py-0.5 text-[0.65rem] font-extrabold text-brand"
              >
                {tool.trim()}
              </span>
            ))}
          </div>
          <div
            className="relative mt-3 h-16 overflow-hidden rounded-xl"
            style={{
              background: `linear-gradient(90deg, ${overlay.accentColor}33, transparent)`,
            }}
          >
            <span
              className="absolute inset-x-6 top-5 h-1 rounded-full"
              style={{ background: overlay.primaryColor }}
            />
            <span
              className="absolute bottom-3 start-10 h-8 w-8 rounded-full border-2"
              style={{ borderColor: overlay.accentColor }}
            />
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface px-4 py-4">
          <p className="text-xs font-extrabold uppercase text-brand-soft">
            {chatLabel}
          </p>
          <p className="mt-2 rounded-2xl bg-background px-3 py-2 text-sm font-semibold text-brand">
            {chatSample}
          </p>
          <p className="mt-3 text-xs font-extrabold uppercase text-brand-soft">
            {filesLabel}
          </p>
          <p className="mt-2 rounded-2xl bg-background px-3 py-2 text-sm font-semibold text-brand">
            {filesSample}
          </p>
          <p className="mt-3 text-xs font-extrabold uppercase text-brand-soft">
            {slidesLabel}
          </p>
          <p className="mt-2 rounded-2xl bg-background px-3 py-2 text-sm font-semibold text-brand">
            {slidesSample}
          </p>
          <p className="mt-3 text-xs font-extrabold uppercase text-brand-soft">
            {bookLabel}
          </p>
          <div className="mt-2 flex items-stretch gap-2">
            <div className="relative h-12 w-10 shrink-0">
              <span className="absolute inset-0 translate-x-1 rounded-sm bg-[#d9c49a]" />
              <span className="absolute inset-0 rounded-sm border border-[#e8d7b5] bg-[#FBF7EF]" />
              <span className="absolute end-0 top-0 h-3 w-3 bg-gradient-to-bl from-[#f3e6d0] to-transparent" />
            </div>
            <p className="flex-1 rounded-2xl bg-background px-3 py-2 text-sm font-semibold text-brand">
              {bookSample}
            </p>
          </div>
          <div className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((page) => (
              <span
                key={page}
                className={`relative h-12 w-8 overflow-hidden rounded-sm border bg-[#FBF7EF] ${
                  page === 4 ? "border-brand-accent ring-2 ring-brand-accent" : "border-line"
                }`}
              >
                {page === 2 || page === 4 ? (
                  <span className="absolute end-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-brand-accent" />
                ) : null}
                <span className="absolute inset-x-0 bottom-0 bg-brand/70 text-center text-[0.5rem] font-extrabold text-white">
                  {page}
                </span>
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {readerSample.split("·").map((item) => (
              <span
                key={item}
                className="rounded-full bg-background px-2 py-0.5 text-[0.65rem] font-extrabold text-brand"
              >
                {item.trim()}
              </span>
            ))}
          </div>
        </div>
        {overlay.caption ? (
          <p className="mt-3 text-xs font-bold text-muted">{overlay.caption}</p>
        ) : null}
      </div>
    </article>
  );
}
