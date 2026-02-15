import { cn } from "@/lib/utils";

type BrandLogoProps = {
  src?: string | null;
  alt?: string;
  brandName?: string;
  variant?: "login" | "sidebar" | "tracking";
  className?: string;
};

const sizes = {
  login: "h-20 w-20 p-2",
  sidebar: "h-9 w-9 p-1",
  tracking: "h-12 w-12 p-1.5",
};

export function BrandLogo({ src, alt = "Logo", brandName = "O", variant = "sidebar", className }: BrandLogoProps) {
  return (
    <div className={cn("rounded-md overflow-hidden bg-transparent border border-white/10 shadow-sm flex items-center justify-center", sizes[variant], className)}>
      {src ? (
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="font-bold text-sm text-primary">{brandName.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}
