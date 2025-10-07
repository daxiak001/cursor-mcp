export function assertDirExists(fs: any, dir: string) {
  const exists = fs.existsSync(dir.replace(/^\.\/?/, ''));
  if (!exists) throw new Error(`Expected dir exists: ${dir}`);
}

export function assertModuleMapPlaceholder() {
  // Placeholder for future expansions
  return true;
}


