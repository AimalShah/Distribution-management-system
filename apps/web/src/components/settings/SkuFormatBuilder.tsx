import { useState } from "react";
import { parseSkuFormat, buildSku, SKU_TOKENS } from "@dms/shared";
import { Badge, Button, Input, Label } from "@dms/ui";

export interface SkuFormatBuilderProps {
  format: string;
  separator: string;
  /** The Company's current SKU sequence, so the preview matches the next real SKU. */
  sequence: number;
  /** Sample brand/category codes for the preview; production values come from the Company. */
  brand?: string;
  category?: string;
  onChange: (next: { format: string; separator: string }) => void;
}

/**
 * The SKU format composer (issue #46, ADR 0007). The live preview runs
 * `buildSku` from `@dms/shared` — the same generator the server's write path
 * calls — so the preview cannot drift from what a product will actually
 * receive.
 */
export function SkuFormatBuilder({
  format,
  separator,
  sequence,
  brand = "ACM",
  category = "COL",
  onChange,
}: SkuFormatBuilderProps) {
  const [draftFormat, setDraftFormat] = useState(format);
  const [draftSeparator, setDraftSeparator] = useState(separator);

  const parsed = parseSkuFormat(draftFormat);

  const applyFormat = (next: string) => {
    setDraftFormat(next);
    onChange({ format: next, separator: draftSeparator });
  };

  const applySeparator = (next: string) => {
    setDraftSeparator(next);
    onChange({ format: draftFormat, separator: next });
  };

  const insertToken = (token: string) => {
    applyFormat(`${draftFormat}{${token}}`);
  };

  return (
    <div className="space-y-4" data-testid="sku-format-builder">
      <div className="space-y-2">
        <Label htmlFor="sku-format">SKU Format</Label>
        <Input
          id="sku-format"
          value={draftFormat}
          onChange={(event) => applyFormat(event.target.value)}
          placeholder="{BRAND}-{CATEGORY}-{SEQ:5}"
        />
        {!parsed.ok && (
          <p className="text-sm text-destructive">
            Unknown token(s): {parsed.unknown.join(", ")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {SKU_TOKENS.map((token) => (
          <Button
            key={token}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => insertToken(token)}
          >
            {token}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sku-separator">Separator</Label>
        <Input
          id="sku-separator"
          value={draftSeparator}
          onChange={(event) => applySeparator(event.target.value)}
          className="max-w-20"
          maxLength={1}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Preview:</span>
        <Badge variant="outline" data-testid="sku-preview" className="font-mono">
          {parsed.ok
            ? buildSku(draftFormat, draftSeparator, {
                brand,
                category,
                name: "Widget",
                sequence,
                date: new Date(),
              })
            : "—"}
        </Badge>
      </div>
    </div>
  );
}
