import Link from "next/link";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonTone = "default" | "inverse";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-accent text-brand shadow-sm hover:brightness-105",
  secondary:
    "border border-brand/15 bg-surface text-brand hover:border-brand/30 hover:bg-white",
  ghost: "text-brand hover:bg-brand/5",
};

const inverseVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-accent text-brand shadow-sm hover:brightness-110",
  secondary:
    "border border-white/30 bg-white/10 text-white hover:bg-white/20",
  ghost: "text-brand-accent hover:bg-white/10 hover:text-white",
};

const sizes = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-6 text-lg",
};

type CommonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  tone?: ButtonTone;
};

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  tone = "default",
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const palette = tone === "inverse" ? inverseVariants : variants;
  return (
    <button
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-40 ${palette[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  className = "",
  variant = "primary",
  size = "md",
  tone = "default",
}: CommonProps & { href: string }) {
  const palette = tone === "inverse" ? inverseVariants : variants;
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition ${palette[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
