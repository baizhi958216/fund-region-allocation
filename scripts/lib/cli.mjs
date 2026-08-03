export function parseArgs(argv, booleanNames = []) {
  const result = {};
  const booleans = new Set(booleanNames);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`unexpected argument: ${token}`);
    }
    const name = token.slice(2);
    if (booleans.has(name)) {
      result[name] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for --${name}`);
    }
    result[name] = value;
    index += 1;
  }
  return result;
}

export function requireArgs(args, names) {
  for (const name of names) {
    if (!args[name]) {
      throw new Error(`missing required argument --${name}`);
    }
  }
}
