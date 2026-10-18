/**
 * Top banner for every /admin page (2026-07-26), rendered via PageHeader's
 * `topBanner` slot between BsdBar and the title. Went through a few rounds
 * of iteration: started as a bottom footer mirroring the customer
 * BrandFooter's gradient direction (cream→teal), then moved to the top
 * (gradient flipped — teal at the outer/top edge fading down into cream, so
 * it blends into the page's own cream background right where the rest of
 * the content begins), and the logo itself lost the light bordered box
 * behind it (just the cropped transparent-background artwork now, no
 * boxed backing). Needs no `-mt-6` of its own (BsdBar already owns the top
 * edge) — only `-mx-6` for horizontal full-bleed.
 *
 * Uses the same `/logo-cropped.png` asset as the customer-facing BrandHero
 * (2026-07-26 — both surfaces converged on the same new logo). This is a
 * flattened PNG, not the original SVG — see BrandHero.tsx for why.
 */
export function AdminBrandHero() {
  return (
    <div className="from-barber-teal/50 -mx-6 flex flex-col items-center bg-gradient-to-b to-cream px-6 pt-10 pb-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-cropped.png"
        alt="Yossi Barber"
        width={3045}
        height={863}
        style={{ height: "auto", width: "auto", maxHeight: 90, maxWidth: "100%" }}
      />
    </div>
  );
}
