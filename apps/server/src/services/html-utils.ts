/**
 * HTML sanitization helper for Puppeteer PDF templates.
 * Escapes characters with special meaning in HTML to prevent XSS / HTML injection
 * when untrusted database strings are interpolated into document HTML.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) {
    return "";
  }

  const str = String(input);

  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface DocumentRenderOptions {
  autoPrint?: boolean;
}

export function renderAutoPrintScript(options?: DocumentRenderOptions): string {
  if (!options?.autoPrint) return "";

  return `
  <script>
    window.addEventListener("DOMContentLoaded", function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    });
  </script>`;
}

