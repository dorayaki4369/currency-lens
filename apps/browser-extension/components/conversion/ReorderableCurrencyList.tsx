import type { CurrencyCode } from "@cl/currency";
import {
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { CircleMinus, GripVertical } from "lucide-react";
import { moveCurrencyRelative, type CurrencyDropPlacement } from "@/lib/currency-order";
import { translate, type UiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { IconButton } from "@/components/ui/icon-button";
import { List, ListItem, ListItemRow } from "@/components/ui/list";
import { FOCUS_WITHIN_RING_CLASS_NAME } from "@/components/ui/focus-ring";

const ROW_EXIT_DURATION_MS = 300;
const ROW_EXIT_FALLBACK_MS = ROW_EXIT_DURATION_MS * 2;

interface DropDestination {
  readonly placement: CurrencyDropPlacement;
  readonly targetCurrency: CurrencyCode;
}

interface CurrencyValueRowActions {
  readonly isDeleting: boolean;
  readonly leadingAction?: ReactNode | undefined;
  readonly trailingAction?: ReactNode | undefined;
}

interface DeletingItem<Item> {
  readonly commitDeletion: () => void;
  readonly currencyCode: CurrencyCode;
  readonly focusCurrency: CurrencyCode | null;
  readonly item: Item;
  readonly nextCurrency: CurrencyCode | null;
  readonly previousCurrency: CurrencyCode | null;
  readonly restoreFocus: boolean;
}

interface ReorderableCurrencyListProps<Item> {
  readonly ariaLabel: string;
  readonly deleteDisabled?:
    | ((item: Item, index: number, activeItemCount: number) => boolean)
    | undefined;
  readonly getCurrencyCode: (item: Item) => CurrencyCode;
  readonly isDeletable: boolean;
  readonly isDraggable: boolean;
  readonly items: readonly Item[];
  readonly listClassName?: string | undefined;
  readonly locale: UiLocale;
  readonly onDelete?: ((currencyCode: CurrencyCode) => void) | undefined;
  readonly onReorder?:
    | ((
        sourceCurrency: CurrencyCode,
        targetCurrency: CurrencyCode,
        placement: CurrencyDropPlacement,
      ) => void)
    | undefined;
  readonly renderItem: (
    item: Item,
    index: number,
    actions: CurrencyValueRowActions,
  ) => ReactNode;
}

/** Owns optional drag and delete behavior around currency value rows. */
export function ReorderableCurrencyList<Item>({
  ariaLabel,
  deleteDisabled,
  getCurrencyCode,
  isDeletable,
  isDraggable,
  items,
  listClassName,
  locale,
  onDelete,
  onReorder,
  renderItem,
}: ReorderableCurrencyListProps<Item>) {
  const instructionsId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const draggedCurrency = useRef<CurrencyCode | null>(null);
  const armedDragHandle = useRef<CurrencyCode | null>(null);
  const dropIndex = useRef<number | null>(null);
  const deleteButtonRefs = useRef(new Map<CurrencyCode, HTMLButtonElement>());
  const deletingItemsRef = useRef<readonly DeletingItem<Item>[]>([]);
  const [draggingCurrency, setDraggingCurrency] = useState<CurrencyCode | null>(null);
  const [visibleDropIndex, setVisibleDropIndex] = useState<number | null>(null);
  const [deletingItems, setDeletingItems] = useState<readonly DeletingItem<Item>[]>([]);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const currencies = items.map(getCurrencyCode);
  const renderedItems = retainDeletingItems(items, deletingItems, getCurrencyCode);
  const deletingCurrencies = new Set(
    deletingItems.map((deletingItem) => deletingItem.currencyCode),
  );
  const activeCurrencies = currencies.filter(
    (currencyCode) => !deletingCurrencies.has(currencyCode),
  );

  /** Commits deletion after the owned exit motion and restores keyboard position. */
  const finishDeletion = useCallback((currencyCode: CurrencyCode) => {
    const deletingItem = deletingItemsRef.current.find(
      (item) => item.currencyCode === currencyCode,
    );
    if (deletingItem === undefined) {
      return;
    }
    const list = listRef.current;
    const deletingRow = findCurrencyRow(list, currencyCode);
    const activeElement = list === null ? null : getRootActiveElement(list);
    const shouldRestoreFocus =
      deletingItem.restoreFocus &&
      (deletingRow?.contains(activeElement) === true ||
        (list !== null && shadowHostRetainsFocus(list, activeElement)));
    const remainingItems = deletingItemsRef.current.filter(
      (item) => item.currencyCode !== currencyCode,
    );
    deletingItemsRef.current = remainingItems;
    setDeletingItems(remainingItems);
    deletingItem.commitDeletion();
    window.requestAnimationFrame(() => {
      if (!shouldRestoreFocus || list === null || !list.isConnected) {
        return;
      }
      const preferredButton =
        deletingItem.focusCurrency === null
          ? undefined
          : deleteButtonRefs.current.get(deletingItem.focusCurrency);
      const fallbackButton = [...deleteButtonRefs.current.values()].find(
        (button) => !button.disabled,
      );
      if (preferredButton?.disabled === false) {
        preferredButton.focus();
        return;
      }
      const preferredRow = findCurrencyRow(list, deletingItem.focusCurrency);
      if (preferredRow !== null) {
        preferredRow.focus();
        return;
      }
      if (fallbackButton !== undefined) {
        fallbackButton.focus();
        return;
      }
      list.focus();
    });
  }, []);

  useEffect(() => {
    if (deletingItems.length === 0) {
      return undefined;
    }
    const reducedMotion =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      for (const deletingItem of deletingItems) {
        finishDeletion(deletingItem.currencyCode);
      }
      return undefined;
    }
    const deletionTimers = deletingItems.map((deletingItem) =>
      window.setTimeout(() => {
        finishDeletion(deletingItem.currencyCode);
      }, ROW_EXIT_FALLBACK_MS),
    );
    return () => {
      for (const deletionTimer of deletionTimers) {
        window.clearTimeout(deletionTimer);
      }
    };
  }, [deletingItems, finishDeletion]);

  /** Clears transient drag feedback without changing the saved order. */
  const finishDragging = () => {
    armedDragHandle.current = null;
    draggedCurrency.current = null;
    dropIndex.current = null;
    setDraggingCurrency(null);
    setVisibleDropIndex(null);
  };

  /** Starts a whole-row drag only after its dedicated handle was pressed. */
  const handleDragStart = (event: ReactDragEvent<HTMLElement>) => {
    const currencyCode = findEventCurrency(event.target, currencies);
    const eventStartedOnHandle =
      event.target instanceof Element &&
      event.target.closest('[data-slot="currency-leading-action"]') !== null;
    if (
      !isDraggable ||
      onReorder === undefined ||
      deletingItems.length > 0 ||
      currencyCode === null ||
      (armedDragHandle.current !== currencyCode && !eventStartedOnHandle)
    ) {
      event.preventDefault();
      return;
    }
    draggedCurrency.current = currencyCode;
    setDraggingCurrency(currencyCode);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", currencyCode);
  };

  /** Arms only the handle pressed for the browser's next native dragstart. */
  const handleMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    const startedOnHandle =
      event.target instanceof Element &&
      event.target.closest('[data-slot="currency-leading-action"]') !== null;
    armedDragHandle.current = startedOnHandle
      ? findEventCurrency(event.target, currencies)
      : null;
  };

  /** Resolves adjacent row halves to one shared insertion boundary. */
  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    const sourceCurrency = draggedCurrency.current;
    if (sourceCurrency === null) {
      return;
    }
    const candidateIndex = getDropIndex(event.currentTarget, event.clientY);
    const sourceIndex = currencies.indexOf(sourceCurrency);
    const nextDropIndex =
      candidateIndex === sourceIndex || candidateIndex === sourceIndex + 1
        ? null
        : candidateIndex;
    dropIndex.current = nextDropIndex;
    setVisibleDropIndex(nextDropIndex);
    if (nextDropIndex === null) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  /** Commits the list's single active insertion boundary. */
  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    const sourceCurrency = draggedCurrency.current;
    const activeDropIndex = dropIndex.current;
    if (sourceCurrency === null || activeDropIndex === null || onReorder === undefined) {
      finishDragging();
      return;
    }
    event.preventDefault();
    const destination = getDropDestination(currencies, sourceCurrency, activeDropIndex);
    if (destination !== null) {
      const nextCurrencies = moveCurrencyRelative(
        currencies,
        sourceCurrency,
        destination.targetCurrency,
        destination.placement,
      );
      onReorder(sourceCurrency, destination.targetCurrency, destination.placement);
      announceMove(sourceCurrency, nextCurrencies);
    }
    finishDragging();
  };

  /** Removes a stale candidate after the pointer leaves the whole list. */
  const handleDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    dropIndex.current = null;
    setVisibleDropIndex(null);
  };

  /** Provides the same adjacent reorder operation to keyboard users. */
  const handleReorderKey = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currencyCode: CurrencyCode,
    index: number,
  ) => {
    if (!isDraggable || onReorder === undefined || deletingItems.length > 0) {
      return;
    }
    let direction: -1 | 1;
    if (event.key === "ArrowUp") {
      direction = -1;
    } else if (event.key === "ArrowDown") {
      direction = 1;
    } else {
      return;
    }
    event.preventDefault();
    const targetCurrency = currencies[index + direction];
    if (targetCurrency === undefined) {
      return;
    }
    const placement = direction === -1 ? "before" : "after";
    const nextCurrencies = moveCurrencyRelative(
      currencies,
      currencyCode,
      targetCurrency,
      placement,
    );
    onReorder(currencyCode, targetCurrency, placement);
    announceMove(currencyCode, nextCurrencies);
  };

  /** Announces a completed move using its position in the resulting order. */
  const announceMove = (
    currencyCode: CurrencyCode,
    nextCurrencies: readonly CurrencyCode[],
  ) => {
    setReorderAnnouncement(
      translate(locale, "reorderMoved", {
        currency: currencyCode,
        position: nextCurrencies.indexOf(currencyCode) + 1,
        total: nextCurrencies.length,
      }),
    );
  };

  /** Starts the visual exit while keeping parent data stable until it finishes. */
  const startDeletion = (item: Item, currencyCode: CurrencyCode, restoreFocus: boolean) => {
    if (
      deletingItemsRef.current.some(
        (deletingItem) => deletingItem.currencyCode === currencyCode,
      )
    ) {
      return;
    }
    const index = currencies.indexOf(currencyCode);
    if (index === -1) {
      return;
    }
    const nextCurrency = currencies[index + 1] ?? null;
    const previousCurrency = currencies[index - 1] ?? null;
    const nextDeletingItems = [
      ...deletingItemsRef.current,
      {
        commitDeletion: () => onDelete?.(currencyCode),
        currencyCode,
        focusCurrency: nextCurrency ?? previousCurrency,
        item,
        nextCurrency,
        previousCurrency,
        restoreFocus,
      },
    ];
    deletingItemsRef.current = nextDeletingItems;
    setDeletingItems(nextDeletingItems);
  };

  /** Creates the list-owned handle while leaving row layout to its leading slot. */
  const renderDragAction = (
    currencyCode: CurrencyCode,
    index: number,
  ): ReactNode | undefined => {
    if (!isDraggable) {
      return undefined;
    }
    return (
      <IconButton
        aria-describedby={instructionsId}
        className="h-8 w-6 cursor-grab text-muted-foreground active:cursor-grabbing"
        disabled={deletingItems.length > 0}
        draggable={false}
        label={translate(locale, "reorderCurrency", {
          currency: currencyCode,
          position: index + 1,
          total: renderedItems.length,
        })}
        onKeyDown={(event) => handleReorderKey(event, currencyCode, index)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <GripVertical aria-hidden="true" />
      </IconButton>
    );
  };

  /** Creates the list-owned delete action while the row retains its trailing slot. */
  const renderDeleteAction = (
    item: Item,
    currencyCode: CurrencyCode,
    index: number,
  ): ReactNode | undefined => {
    if (!isDeletable) {
      return undefined;
    }
    const isDeleting = deletingItems.some(
      (deletingItem) => deletingItem.currencyCode === currencyCode,
    );
    const currentIndex = activeCurrencies.indexOf(currencyCode);
    return (
      <HoverTooltip
        content={translate(locale, "removeCurrency", { currency: currencyCode })}
      >
        <IconButton
          aria-disabled={isDeleting || undefined}
          className="text-destructive hover:text-destructive disabled:text-muted-foreground disabled:hover:text-muted-foreground"
          disabled={
            onDelete === undefined ||
            (!isDeleting &&
              (deleteDisabled?.(
                item,
                currentIndex === -1 ? index : currentIndex,
                activeCurrencies.length,
              ) ??
                false))
          }
          label={translate(locale, "removeCurrency", { currency: currencyCode })}
          onClick={
            isDeleting
              ? undefined
              : (event) =>
                  startDeletion(
                    item,
                    currencyCode,
                    event.detail === 0 || event.currentTarget.matches(":focus"),
                  )
          }
          ref={(button) => {
            if (button === null) {
              deleteButtonRefs.current.delete(currencyCode);
            } else {
              deleteButtonRefs.current.set(currencyCode, button);
            }
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <CircleMinus aria-hidden="true" />
        </IconButton>
      </HoverTooltip>
    );
  };

  return (
    <>
      {isDraggable ? (
        <span className="sr-only" id={instructionsId}>
          {translate(locale, "reorderInstructions")}
        </span>
      ) : null}
      <List
        aria-label={ariaLabel}
        as="ol"
        className={listClassName}
        data-deletable={isDeletable ? "true" : undefined}
        data-draggable={isDraggable ? "true" : undefined}
        onDragEnd={finishDragging}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        onDrop={handleDrop}
        onMouseDown={handleMouseDown}
        onMouseUp={() => {
          armedDragHandle.current = null;
        }}
        ref={listRef}
      >
        {renderedItems.map((item, index) => {
          const currencyCode = getCurrencyCode(item);
          const isDeleting = deletingItems.some(
            (deletingItem) => deletingItem.currencyCode === currencyCode,
          );
          const dropPlacement = getVisibleDropPlacement(visibleDropIndex, index);
          const leadingAction = renderDragAction(currencyCode, index);
          const trailingAction = renderDeleteAction(item, currencyCode, index);
          return (
            <ListItem
              as="li"
              className={cn(
                "focus-within:ring-inset data-[dragging=true]:opacity-50",
                FOCUS_WITHIN_RING_CLASS_NAME,
              )}
              data-list-currency-code={currencyCode}
              data-delete-state={isDeleting ? "exiting" : undefined}
              data-dragging={draggingCurrency === currencyCode ? "true" : undefined}
              data-drop-placement={dropPlacement}
              draggable={isDraggable && deletingItems.length === 0}
              key={currencyCode}
              tabIndex={-1}
            >
              <div
                className={cn(
                  "grid grid-rows-[1fr] overflow-hidden motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-in-out",
                  isDeleting && "grid-rows-[0fr]",
                )}
                data-slot="list-item-reveal"
              >
                <div className="min-h-0 overflow-hidden">
                  <ListItemRow
                    className={cn(
                      "relative motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-in-out",
                      isDeleting && "-translate-y-full pointer-events-none",
                    )}
                    onTransitionEnd={(event: ReactTransitionEvent<HTMLDivElement>) => {
                      if (
                        event.currentTarget === event.target &&
                        event.propertyName === "translate"
                      ) {
                        finishDeletion(currencyCode);
                      }
                    }}
                  >
                    {renderItem(item, index, {
                      isDeleting,
                      leadingAction,
                      trailingAction,
                    })}
                  </ListItemRow>
                </div>
              </div>
              {dropPlacement === undefined ? null : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-x-3 z-20 h-0.5 bg-primary",
                    dropPlacement === "before" ? "top-0" : "-bottom-px",
                  )}
                  data-slot="currency-drop-indicator"
                />
              )}
            </ListItem>
          );
        })}
      </List>
      <span aria-atomic="true" aria-live="polite" className="sr-only">
        {reorderAnnouncement}
      </span>
    </>
  );
}

/** Keeps exiting snapshots mounted if parent data changes before motion settles. */
function retainDeletingItems<Item>(
  items: readonly Item[],
  deletingItems: readonly DeletingItem<Item>[],
  getCurrencyCode: (item: Item) => CurrencyCode,
): readonly Item[] {
  if (deletingItems.length === 0) {
    return items;
  }
  const renderedItems = [...items];
  for (const deletingItem of deletingItems.toReversed()) {
    const currentIndex = renderedItems.findIndex(
      (item) => getCurrencyCode(item) === deletingItem.currencyCode,
    );
    if (currentIndex !== -1) {
      renderedItems[currentIndex] = deletingItem.item;
      continue;
    }
    const nextIndex = renderedItems.findIndex(
      (item) => getCurrencyCode(item) === deletingItem.nextCurrency,
    );
    if (nextIndex !== -1) {
      renderedItems.splice(nextIndex, 0, deletingItem.item);
      continue;
    }
    const previousIndex = renderedItems.findIndex(
      (item) => getCurrencyCode(item) === deletingItem.previousCurrency,
    );
    renderedItems.splice(
      previousIndex === -1 ? renderedItems.length : previousIndex + 1,
      0,
      deletingItem.item,
    );
  }
  return renderedItems;
}

/** Finds one direct list row without relying on selector interpolation. */
function findCurrencyRow(
  list: HTMLElement | null,
  currencyCode: CurrencyCode | null,
): HTMLElement | null {
  if (list === null || currencyCode === null) {
    return null;
  }
  return (
    [...list.children].find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.dataset["listCurrencyCode"] === currencyCode,
    ) ?? null
  );
}

/** Reads focus from the document or ShadowRoot that owns this list. */
function getRootActiveElement(element: HTMLElement): Element | null {
  const root = element.getRootNode();
  if (root === element.ownerDocument) {
    return element.ownerDocument.activeElement;
  }
  return root instanceof ShadowRoot ? root.activeElement : null;
}

/** Handles environments that expose only the focused Shadow host to the document. */
function shadowHostRetainsFocus(
  element: HTMLElement,
  activeElement: Element | null,
): boolean {
  const root = element.getRootNode();
  return (
    activeElement === null &&
    root instanceof ShadowRoot &&
    element.ownerDocument.activeElement === root.host
  );
}

/** Finds the currency row that originated a bubbled list event. */
function findEventCurrency(
  target: EventTarget,
  currencies: readonly CurrencyCode[],
): CurrencyCode | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const value = target.closest<HTMLElement>("[data-list-currency-code]")?.dataset[
    "listCurrencyCode"
  ];
  return currencies.find((currency) => currency === value) ?? null;
}

/** Maps a pointer coordinate to one boundary shared by both adjacent rows. */
function getDropIndex(list: HTMLElement, clientY: number): number {
  const rows = [...list.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset["listCurrencyCode"] !== undefined,
  );
  const nextRowIndex = rows.findIndex((row) => {
    const bounds = row.getBoundingClientRect();
    return clientY < bounds.top + bounds.height / 2;
  });
  return nextRowIndex === -1 ? rows.length : nextRowIndex;
}

/** Converts one insertion boundary to the existing relative-move contract. */
function getDropDestination(
  currencies: readonly CurrencyCode[],
  sourceCurrency: CurrencyCode,
  activeDropIndex: number,
): DropDestination | null {
  const sourceIndex = currencies.indexOf(sourceCurrency);
  if (activeDropIndex === sourceIndex || activeDropIndex === sourceIndex + 1) {
    return null;
  }
  if (activeDropIndex < sourceIndex) {
    // A non-negative boundary before an existing source always addresses an item.
    return { placement: "before", targetCurrency: currencies[activeDropIndex]! };
  }
  const targetCurrency = currencies[activeDropIndex - 1];
  return targetCurrency === undefined ? null : { placement: "after", targetCurrency };
}

/** Anchors one boundary indicator to exactly one adjacent row. */
function getVisibleDropPlacement(
  activeDropIndex: number | null,
  itemIndex: number,
): CurrencyDropPlacement | undefined {
  if (activeDropIndex === 0 && itemIndex === 0) {
    return "before";
  }
  return activeDropIndex === itemIndex + 1 ? "after" : undefined;
}
