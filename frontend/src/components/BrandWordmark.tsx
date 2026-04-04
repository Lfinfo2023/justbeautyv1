import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

const BrandWordmark = ({ className, titleClassName, subtitleClassName }: BrandWordmarkProps) => {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span className={cn("font-display font-semibold tracking-wide text-foreground", titleClassName)}>
        Just Beauty
      </span>
      <span className={cn("ml-[0.38rem] mt-1 text-[0.55em] font-medium uppercase tracking-[0.28em] text-muted-foreground/80", subtitleClassName)}>
        by Justine
      </span>
    </span>
  );
};

export default BrandWordmark;
