import { Globe } from "lucide-react";
import { Button } from "@dms/ui";
import { useI18n } from "../../lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, toggleLanguage } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className={`h-8 px-2 text-xs font-medium gap-1.5 ${className}`}
      title={language === "en" ? "اردو میں دیکھیں (Switch to Urdu)" : "Switch to English"}
      aria-label="Toggle language"
    >
      <Globe className="size-3.5" />
      <span>{language === "en" ? "اردو" : "English"}</span>
    </Button>
  );
}
