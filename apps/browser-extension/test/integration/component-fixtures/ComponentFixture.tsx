import { useEffect, type CSSProperties, type ReactNode } from "react";
import { AppComponentFixture } from "@/test/integration/component-fixtures/AppComponentFixture";
import {
  COMPONENT_FIXTURES,
  type ComponentFixtureId,
} from "@/test/integration/component-fixtures/fixtures";
import {
  isUiFixtureId,
  UiComponentFixture,
} from "@/test/integration/component-fixtures/UiComponentFixture";

interface ComponentFixtureProps {
  readonly fixture: (typeof COMPONENT_FIXTURES)[number];
}

interface ThemePanelStyle extends CSSProperties {
  readonly "--fixture-dialog-left": string;
}

/** Renders one component in both themes for browser integration checks. */
export function ComponentFixture({ fixture }: ComponentFixtureProps) {
  useFixtureInteractions(fixture.id);

  return (
    <main className="grid min-h-screen grid-cols-2 gap-px overflow-hidden bg-border [&_*]:!animate-none [&_*]:!transition-none">
      <ThemePanel label="Light" theme="light">
        <FixtureContent fixtureId={fixture.id} />
      </ThemePanel>
      <ThemePanel label="Dark" theme="dark">
        <FixtureContent fixtureId={fixture.id} />
      </ThemePanel>
    </main>
  );
}

function ThemePanel({
  children,
  label,
  theme,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly theme: "dark" | "light";
}) {
  const style: ThemePanelStyle = {
    "--fixture-dialog-left": theme === "dark" ? "50vw" : "0",
  };

  return (
    <section
      className={`${theme === "dark" ? "dark " : ""}theme-${theme} flex min-h-screen min-w-0 flex-col bg-background p-6 text-foreground`}
      data-fixture-theme={theme}
      style={style}
    >
      <p className="mb-4 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="w-full min-w-0 max-w-lg">{children}</div>
    </section>
  );
}

function FixtureContent({ fixtureId }: { readonly fixtureId: ComponentFixtureId }) {
  return isUiFixtureId(fixtureId) ? (
    <UiComponentFixture fixtureId={fixtureId} />
  ) : (
    <AppComponentFixture fixtureId={fixtureId} />
  );
}

/** Opens interaction-dependent fixtures after both themed copies have mounted. */
function useFixtureInteractions(fixtureId: string): void {
  useEffect(() => {
    let readyFrame = 0;
    const interactionFrame = requestAnimationFrame(() => {
      if (fixtureId === "hover-tooltip") {
        for (const trigger of document.querySelectorAll<HTMLButtonElement>(
          "[data-fixture-hover-tooltip] button",
        )) {
          trigger.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        }
      }
      readyFrame = requestAnimationFrame(() => {
        document.documentElement.dataset["componentFixtureReady"] = "true";
      });
    });
    return () => {
      cancelAnimationFrame(interactionFrame);
      cancelAnimationFrame(readyFrame);
    };
  }, [fixtureId]);
}
