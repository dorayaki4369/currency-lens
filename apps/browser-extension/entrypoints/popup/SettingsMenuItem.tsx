import type { ReactNode, RefObject } from "react";
import { ChevronRight, ExternalLink, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/list";
import {
  ROW_INSET_CLASS_NAME,
  ROW_TOUCH_TARGET_CLASS_NAME,
} from "@/components/ui/row-control";

const MENU_ITEM_CLASS_NAME = `h-auto w-full justify-between bg-transparent font-normal focus-visible:ring-inset ${ROW_INSET_CLASS_NAME} ${ROW_TOUCH_TARGET_CLASS_NAME}`;

type SettingsMenuItemProps = {
  readonly icon: LucideIcon;
  readonly label: string;
} & (
  | {
      readonly buttonReference: RefObject<HTMLButtonElement | null>;
      readonly onClick: () => void;
    }
  | {
      /** Opens outside the popup, so screen readers also hear newTabLabel. */
      readonly href: string;
      readonly newTabLabel: string;
    }
);

/** Renders one popup menu row that opens a nested route or an external page. */
export function SettingsMenuItem(props: SettingsMenuItemProps) {
  const { icon: Icon, label } = props;
  if ("href" in props) {
    return (
      <SettingsMenuItemFrame>
        <Button asChild className={MENU_ITEM_CLASS_NAME} variant="secondary">
          <a href={props.href} rel="noreferrer" target="_blank">
            <Icon aria-hidden="true" />
            <span className="flex-1 truncate text-left">
              {label}
              <span className="sr-only">{props.newTabLabel}</span>
            </span>
            <ExternalLink aria-hidden="true" className="text-muted-foreground" />
          </a>
        </Button>
      </SettingsMenuItemFrame>
    );
  }
  return (
    <SettingsMenuItemFrame>
      <Button
        className={MENU_ITEM_CLASS_NAME}
        onClick={props.onClick}
        ref={props.buttonReference}
        type="button"
        variant="secondary"
      >
        <Icon aria-hidden="true" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight aria-hidden="true" />
      </Button>
    </SettingsMenuItemFrame>
  );
}

/** Gives every menu row its own card so rows read as separate destinations. */
function SettingsMenuItemFrame({ children }: { readonly children: ReactNode }) {
  return (
    <ListItem as="li" dividerVisibility="hidden">
      <Card spacing="flush">{children}</Card>
    </ListItem>
  );
}
