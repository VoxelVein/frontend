import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useCustomCursor } from "@/hooks/use-custom-cursor";

/** Browser-local display preferences that do not belong to the account. */
export const SettingsAppearance = () => {
  const { customCursorEnabled, setCustomCursorEnabled } = useCustomCursor();

  return (
    <section aria-labelledby="settings-appearance-heading">
      <Card>
        <CardHeader>
          <h2
            className="text-foreground text-lg font-semibold"
            id="settings-appearance-heading"
          >
            Appearance
          </h2>
          <CardDescription>
            Display preferences for this browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field orientation="horizontal">
            <FieldContent>
              <div className="flex flex-wrap items-center gap-2">
                <FieldLabel htmlFor="custom-cursor-switch">
                  Custom cursor
                </FieldLabel>
                <span className="inline-flex min-h-5 items-center rounded border border-yellow-500/30 bg-yellow-400/15 px-1.5 text-[10px] font-bold tracking-wide text-yellow-700 uppercase dark:text-yellow-400">
                  Beta
                </span>
              </div>
              <FieldDescription id="custom-cursor-description">
                Show the VoxelVein arrow across the site. Links, text fields and
                resize handles keep their usual cursor.
              </FieldDescription>
            </FieldContent>
            <Switch
              aria-describedby="custom-cursor-description"
              checked={customCursorEnabled}
              id="custom-cursor-switch"
              onCheckedChange={setCustomCursorEnabled}
            />
          </Field>
        </CardContent>
      </Card>
    </section>
  );
};
