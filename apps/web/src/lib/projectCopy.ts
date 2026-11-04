/** Allocate a readable copy name without colliding with an existing project. */
export function projectCopyName(name: string, existingNames: string[], suffix = 'copy'): string {
  const used = new Set(existingNames.map(value => value.trim().toLocaleLowerCase()));
  for (let number = 1; ; number++) {
    const tail = ` (${suffix}${number === 1 ? '' : ` ${number}`})`;
    const candidate = name.trim().slice(0, Math.max(0, 80 - tail.length)) + tail;
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
}

// Preserve IDs inside a scene: rulers, groups and history refer to them. The new
// project ID scopes persistence; clone buffers too so edits cannot affect source.
export function copyProjectContents<T>(contents: T): T {
  return structuredClone(contents);
}
