/**
 * Render-time CSS injection that overrides the accent palette when the
 * tenant has set a brand colour. Validated once more right here as
 * defence in depth — `dangerouslySetInnerHTML` makes CSS injection a
 * real risk if a forged value ever slipped past Zod.
 */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type Props = {
  accentHex: string | null;
};

export function BrandStyle({ accentHex }: Props) {
  if (!accentHex || !HEX_RE.test(accentHex)) {
    return null;
  }

  // Override both light + dark mode primary/ring slots with the tenant
  // colour. Tailwind v4 mixes via color-mix() so hex is fine as input.
  const css = `:root,.dark{--primary:${accentHex};--ring:${accentHex};}`;

  // Static, validated string — no user-controlled interpolation reaches
  // the CSS bytes other than the hex itself.
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
