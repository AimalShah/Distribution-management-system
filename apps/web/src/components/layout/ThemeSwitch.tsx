import { useEffect, useState } from "react";
import { Check, Moon, Sun } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@dms/ui";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "dms-theme";

/**
 * `theme.css` switches on a `.dark` ancestor, so the whole job here is putting
 * that class on `<html>` — no theme object, no provider, and the stylesheet
 * still works for a user who never touches this menu.
 */
function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark" || (theme === "system" && prefersDark)
  );
}

/** Light / dark / system, as the reference's header switch. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system"
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // "system" is a live subscription, not a one-time read: flipping the OS
    // preference has to move the app without a reload.
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Toggle theme"
        >
          <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(["light", "dark", "system"] as const).map((option) => (
          <DropdownMenuItem key={option} onClick={() => setTheme(option)}>
            {option === "light"
              ? "Light"
              : option === "dark"
                ? "Dark"
                : "System"}
            <Check
              size={14}
              className={cn("ms-auto", theme !== option && "hidden")}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
