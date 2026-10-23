import { CircleAlert, Settings } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stack } from "@/components/layout/Stack";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useId, type ReactNode } from "react";
import type { ComponentFixtureId } from "@/test/integration/component-fixtures/fixtures";

const UI_FIXTURE_IDS = [
  "alert",
  "badge",
  "button",
  "card",
  "checkbox",
  "command",
  "input",
  "native-select",
  "popover",
  "skeleton",
  "tooltip",
] as const satisfies readonly ComponentFixtureId[];

export type UiFixtureId = (typeof UI_FIXTURE_IDS)[number];

interface UiComponentFixtureProps {
  readonly fixtureId: UiFixtureId;
}

/** Renders one shadcn primitive in representative browser-integration states. */
export function UiComponentFixture({ fixtureId }: UiComponentFixtureProps) {
  const fixtures = {
    alert: (
      <Alert>
        <CircleAlert aria-hidden="true" />
        <AlertTitle>レートを取得できません</AlertTitle>
        <AlertDescription>最後に取得したレートを表示しています。</AlertDescription>
      </Alert>
    ),
    badge: (
      <div className="flex flex-wrap gap-2">
        <Badge>既定</Badge>
        <Badge variant="secondary">デフォルト</Badge>
        <Badge variant="outline">閲覧のみ</Badge>
        <Badge variant="destructive">エラー</Badge>
      </div>
    ),
    button: (
      <div className="flex flex-wrap items-center gap-2">
        <Button>保存</Button>
        <Button variant="secondary">キャンセル</Button>
        <Button variant="outline">追加</Button>
        <Button variant="ghost">戻る</Button>
        <Button disabled>保存</Button>
      </div>
    ),
    card: (
      <Card>
        <CardContent>
          <Stack>
            <h2 className="font-semibold">換算設定</h2>
            <p className="text-sm text-muted-foreground">
              換算元と換算後に表示する通貨を設定します。
            </p>
            <Button size="sm">設定を開く</Button>
          </Stack>
        </CardContent>
      </Card>
    ),
    checkbox: (
      <Stack gap={3}>
        <Label>
          <Checkbox defaultChecked />
          レート更新を通知
        </Label>
        <Label>
          <Checkbox />
          古いレートを強調
        </Label>
        <Label>
          <Checkbox disabled />
          利用できません
        </Label>
      </Stack>
    ),
    command: (
      <Command className="border">
        <CommandInput placeholder="通貨を検索" />
        <CommandList>
          <CommandEmpty>該当する通貨はありません</CommandEmpty>
          <CommandGroup>
            <CommandItem value="JPY">JPY　日本円</CommandItem>
            <CommandItem value="USD">USD　米ドル</CommandItem>
            <CommandItem value="EUR">EUR　ユーロ</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    ),
    input: <InputFixture />,
    "native-select": <NativeSelectFixture />,
    popover: (
      <Popover open>
        <PopoverTrigger asChild>
          <Button variant="outline">通貨を選択</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="表示する通貨" align="start" portalled={false}>
          <p className="text-sm font-medium">表示する通貨</p>
          <p className="mt-1 text-xs text-muted-foreground">最大5通貨まで選択できます。</p>
        </PopoverContent>
      </Popover>
    ),
    skeleton: (
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <Stack className="flex-1">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-4/5" />
        </Stack>
      </div>
    ),
    tooltip: (
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button aria-label="設定" size="icon" variant="outline">
              <Settings />
            </Button>
          </TooltipTrigger>
          <TooltipContent portalled={false}>設定</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
  } satisfies Readonly<Record<UiFixtureId, ReactNode>>;
  return fixtures[fixtureId];
}

/** Narrows a component fixture before it is rendered by the primitive fixture map. */
export function isUiFixtureId(fixtureId: ComponentFixtureId): fixtureId is UiFixtureId {
  return UI_FIXTURE_IDS.some((candidate) => candidate === fixtureId);
}

function InputFixture() {
  const inputId = useId();
  return (
    <Stack>
      <Label htmlFor={inputId}>金額</Label>
      <Input defaultValue="1,234.56" id={inputId} inputMode="decimal" />
    </Stack>
  );
}

function NativeSelectFixture() {
  const selectId = useId();
  return (
    <Stack>
      <Label htmlFor={selectId}>テーマ</Label>
      <NativeSelect defaultValue="system" id={selectId} wrapperClassName="w-full">
        <NativeSelectOption value="system">システム</NativeSelectOption>
        <NativeSelectOption value="light">ライト</NativeSelectOption>
        <NativeSelectOption value="dark">ダーク</NativeSelectOption>
      </NativeSelect>
    </Stack>
  );
}
