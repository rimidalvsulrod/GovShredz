import clsx from "clsx";

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={clsx("font-display grid shrink-0 place-items-center rounded-[28%] bg-lime font-black text-black italic lime-glow", className)}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
    >
      GS
    </span>
  );
}

export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="font-display font-black tracking-wide italic" style={{ fontSize: size * 0.62 }}>
        GOV<span className="text-lime">SHREDZ</span>
      </span>
    </span>
  );
}
