const fence = "```";
export function fenced(page: string, language: string, title: string): string {
  const tags = language === "hcl" && title.endsWith(".rf.hcl") ? ["hcl", "rf"] : [language];
  const matches = tags.flatMap((tag) => {
    const opening = `${fence}${tag} title="${title}"\n`;
    const parts = page.split(opening);
    return parts.length === 2 ? [parts[1]?.split(`\n${fence}`)[0]] : [];
  });
  if (matches.length !== 1 || !matches[0]) throw new Error(`expected 1 ${title} block`);
  return `${matches[0]}\n`;
}
