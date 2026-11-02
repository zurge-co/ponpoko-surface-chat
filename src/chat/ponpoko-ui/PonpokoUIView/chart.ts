export function chartPath(points: number[], width: number, height: number, pad: number): string {
  if (points.length === 0) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (index: number) =>
    points.length === 1 ? width / 2 : pad + (index / (points.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);
  return points
    .map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(value).toFixed(2)}`)
    .join(" ");
}

export function patchLineClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) return "tok-meta";
  if (line.startsWith("@@")) return "text-accent-gold";
  if (line.startsWith("+")) return "tok-insert";
  if (line.startsWith("-")) return "tok-delete";
  return "text-fg-muted";
}
