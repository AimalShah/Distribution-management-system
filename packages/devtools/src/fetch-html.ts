export async function fetchRenderedHtml(url: string) {
  const res = await fetch(url);
  return { url, dom: await res.text() };
}
