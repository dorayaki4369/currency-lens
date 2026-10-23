import {
  type AnimationEvent,
  type ComponentPropsWithoutRef,
  useLayoutEffect,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type NumberDirection = "down" | "up";

interface NumberSnapshot {
  readonly text: string;
  readonly value: number;
}

interface AnimatedNumberState {
  readonly current: NumberSnapshot;
  readonly direction: NumberDirection | null;
  readonly previous: NumberSnapshot | null;
  readonly revision: number;
}

export interface AnimatedNumberProps extends Omit<
  ComponentPropsWithoutRef<"span">,
  "children"
> {
  readonly text: string;
  readonly value: number;
}

/** Rolls changed glyphs upward for increases and downward for decreases. */
export function AnimatedNumber({ className, text, value, ...props }: AnimatedNumberProps) {
  const [state, setState] = useState<AnimatedNumberState>(() => ({
    current: { text, value },
    direction: null,
    previous: null,
    revision: 0,
  }));

  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setState((currentState) => {
      const next = { text, value };
      if (
        currentState.current.text === next.text &&
        currentState.current.value === next.value
      ) {
        return currentState;
      }
      const direction = reducedMotion
        ? null
        : getNumberDirection(currentState.current, next);
      return {
        current: next,
        direction,
        previous: direction === null ? null : currentState.current,
        revision: currentState.revision + 1,
      };
    });
  }, [text, value]);

  const currentCharacters = Array.from(state.current.text);
  const previousCharacters = Array.from(state.previous?.text ?? "");
  const characterCount = Math.max(currentCharacters.length, previousCharacters.length);
  const alignedCurrentCharacters = alignCharacters(currentCharacters, characterCount);
  const alignedPreviousCharacters = alignCharacters(previousCharacters, characterCount);
  const lastChangedIndex = alignedCurrentCharacters.findLastIndex(
    (character, index) => character !== alignedPreviousCharacters[index],
  );

  const finishTransition = (_event: AnimationEvent<HTMLSpanElement>) => {
    setState((currentState) => ({
      ...currentState,
      direction: null,
      previous: null,
    }));
  };

  return (
    <span
      {...props}
      className={cn("inline-flex max-w-full justify-end tabular-nums", className)}
      data-direction={state.direction ?? undefined}
      data-slot="animated-number"
    >
      <span className="sr-only" data-slot="animated-number-label">
        {state.current.text}
      </span>
      <span
        aria-hidden="true"
        className="inline-flex max-w-full justify-end"
        data-slot="animated-number-characters"
      >
        {alignedCurrentCharacters.map((currentCharacter, index) => {
          const previousCharacter = alignedPreviousCharacters[index]!;
          const changed =
            state.direction !== null && currentCharacter !== previousCharacter;
          const renderCurrentCharacter = renderCharacter(currentCharacter);
          return (
            <span
              className="relative inline-grid overflow-hidden"
              data-slot="animated-number-glyph"
              key={`${String(characterCount)}-${String(index)}`}
            >
              <span className="invisible col-start-1 row-start-1">
                {renderCurrentCharacter}
              </span>
              {changed ? (
                <>
                  <span className="invisible col-start-1 row-start-1">
                    {renderCharacter(previousCharacter)}
                  </span>
                  <span
                    className={cn("absolute inset-0 motion-reduce:hidden")}
                    data-slot="animated-number-outgoing"
                    key={`outgoing-${String(state.revision)}`}
                  >
                    {renderCharacter(previousCharacter)}
                  </span>
                  <span
                    className="absolute inset-0"
                    data-slot="animated-number-incoming"
                    key={`incoming-${String(state.revision)}`}
                    onAnimationEnd={
                      index === lastChangedIndex ? finishTransition : undefined
                    }
                  >
                    {renderCurrentCharacter}
                  </span>
                </>
              ) : (
                <span className="absolute inset-0" data-slot="animated-number-current">
                  {renderCurrentCharacter}
                </span>
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Selects motion only when the rendered number visibly changes. */
function getNumberDirection(
  previous: NumberSnapshot,
  current: NumberSnapshot,
): NumberDirection | null {
  if (previous.text === current.text || previous.value === current.value) {
    return null;
  }
  return current.value > previous.value ? "up" : "down";
}

/** Right-aligns glyph columns so decimal places remain stable across digit-count changes. */
function alignCharacters(characters: readonly string[], length: number): readonly string[] {
  return [...Array<string>(length - characters.length).fill(""), ...characters];
}

/** Keeps an empty reel column measurable until its outgoing glyph has left. */
function renderCharacter(character: string): string {
  return character === "" ? "\u00a0" : character;
}
