export function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-6xl 2xl:max-w-7xl ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] sm:ps-[max(1.5rem,env(safe-area-inset-left))] sm:pe-[max(1.5rem,env(safe-area-inset-right))] lg:ps-[max(2rem,env(safe-area-inset-left))] lg:pe-[max(2rem,env(safe-area-inset-right))] ${className}`}
    >
      {children}
    </div>
  );
}
