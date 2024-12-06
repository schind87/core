export const getStyleSheet = async (href: string): Promise<CSSStyleSheet> => {
  const response = await fetch(href);
  const text = await response.text();
  const sheet = new CSSStyleSheet();
  await sheet.replace(text);
  return sheet;
};
