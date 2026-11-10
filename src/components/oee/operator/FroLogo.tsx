/** FlowReport logo (docs/legacy/logo-long.png, copied to /logo-long.png). Collapsed = the hexagon mark only. */
export function FroLogo({ collapsed, className = "" }: { collapsed: boolean; className?: string }) {
  if (collapsed) {
    return (
      <span
        role="img"
        aria-label="FlowReport"
        data-testid="fro-logo-mark"
        className={`inline-block size-9 shrink-0 ${className}`}
        // the hexagon is the left 350 px of the 1800 x 350 logo
        style={{ backgroundImage: "url(/logo-long.png)", backgroundRepeat: "no-repeat", backgroundPosition: "left center", backgroundSize: "auto 100%" }}
      />
    );
  }
  return <img src="/logo-long.png" alt="FlowReport" data-testid="fro-logo" className={`h-8 w-auto ${className}`} />;
}
