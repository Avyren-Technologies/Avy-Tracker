#!/usr/bin/env node
/**
 * scripts/find-used-deps.js
 *
 * Scans ./app for import/require statements and reports which packages
 * from package.json (dependencies & devDependencies) are actually imported.
 *
 * Usage:
 *   node ./scripts/find-used-deps.js
 *
 * Notes:
 *  - Only scans files under ./app (relative to repo root).
 *  - Scans file extensions: .js .jsx .ts .tsx .mjs .cjs
 *  - Treats import specifiers like:
 *      import X from 'pkg'
 *      import 'pkg'
 *      export ... from 'pkg'
 *      const X = require('pkg')
 *      import('pkg')
 *    and normalizes "pkg/subpath" -> "pkg" (scoped packages keep @scope/pkg).
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'app');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

// Utility: read package.json
function readPackageJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading package.json:', err.message);
    process.exit(1);
  }
}

// Walk directory recursively and collect files with allowed extensions
function collectFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      // Skip node_modules if mistakenly under app
      if (it.name === 'node_modules') continue;
      files.push(...collectFiles(full));
    } else if (it.isFile()) {
      if (EXTENSIONS.has(path.extname(it.name))) files.push(full);
    }
  }
  return files;
}

// Given a module specifier string, determine package base name
// Examples:
//  - 'lodash/get' -> 'lodash'
//  - '@react-navigation/native' -> '@react-navigation/native'
//  - '@scope/pkg/sub/path' -> '@scope/pkg'
function getPackageNameFromSpecifier(spec) {
  if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('http')) {
    // relative or absolute path or url — not a package
    return null;
  }
  // scoped
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`; // @scope/name
    }
    return spec; // fallback
  } else {
    const parts = spec.split('/');
    return parts[0];
  }
}

// Extract all module specifiers from file content using regex patterns
function extractSpecifiers(content) {
  const specifiers = new Set();

  // Patterns to match:
  // import ... from 'x'
  // import 'x'
  // export ... from 'x'
  // require('x')
  // import('x')
  // We'll run several regexes in global mode
  const patterns = [
    /import\s+(?:[^'"]+\s+from\s+)?['"`]([^'"`]+)['"`]/g,         // import / import ... from
    /export\s+(?:[^'"]+\s+from\s+)?['"`]([^'"`]+)['"`]/g,         // export ... from / export 'x'
    /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,                  // require('x')
    /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g                    // import('x')
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      if (m[1]) specifiers.add(m[1]);
    }
  }

  return Array.from(specifiers);
}

// Main
function main() {
  if (!fs.existsSync(PACKAGE_JSON)) {
    console.error('package.json not found in repo root:', ROOT);
    process.exit(1);
  }

  const pkg = readPackageJson(PACKAGE_JSON);
  const deps = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
  const devDeps = pkg.devDependencies ? Object.keys(pkg.devDependencies) : [];
  const allDeclared = new Set([...deps, ...devDeps]);

  if (!fs.existsSync(APP_DIR)) {
    console.error('app directory not found at', APP_DIR);
    process.exit(1);
  }

  console.log('Scanning', APP_DIR, 'for source files...');
  const files = collectFiles(APP_DIR);
  if (files.length === 0) {
    console.log('No JS/TS files found under app/. Exiting.');
    process.exit(0);
  }
  // console.log('Found', files.length, 'files');

  const usedPackageBases = new Set();
  const usedSpecifiersFull = new Set();

  for (const f of files) {
    let content = '';
    try {
      content = fs.readFileSync(f, 'utf8');
    } catch (err) {
      console.warn('Could not read file', f, err.message);
      continue;
    }
    const specs = extractSpecifiers(content);
    for (const s of specs) {
      usedSpecifiersFull.add(s);
      const pkgName = getPackageNameFromSpecifier(s);
      if (pkgName) usedPackageBases.add(pkgName);
    }
  }

  // Build report
  const usedDeclaredDeps = deps.filter(d => usedPackageBases.has(d)).sort();
  const usedDeclaredDevDeps = devDeps.filter(d => usedPackageBases.has(d)).sort();

  const declaredButNotUsed = [...allDeclared].filter(x => !usedPackageBases.has(x)).sort();
  const usedButNotDeclared = [...usedPackageBases].filter(x => !allDeclared.has(x)).sort();

  const report = {
    summary: {
      scannedFiles: files.length,
      declaredDependencies: deps.length,
      declaredDevDependencies: devDeps.length,
      usedPackageCount: usedPackageBases.size,
      usedDeclaredDeps: usedDeclaredDeps.length,
      usedDeclaredDevDeps: usedDeclaredDevDeps.length,
      declaredButNotUsed: declaredButNotUsed.length,
      usedButNotDeclared: usedButNotDeclared.length
    },
    usedDeclaredDeps,
    usedDeclaredDevDeps,
    declaredButNotUsed,
    usedButNotDeclared,
    allUsedSpecifiers: Array.from(usedSpecifiersFull).sort()
  };

  // Print nice output
  console.log('\n=== Dependency usage report (scanned ./app) ===\n');
  console.log('Used (from dependencies):', usedDeclaredDeps.length ? '' : '(none)');
  usedDeclaredDeps.forEach(d => console.log('  -', d));
  console.log('\nUsed (from devDependencies):', usedDeclaredDevDeps.length ? '' : '(none)');
  usedDeclaredDevDeps.forEach(d => console.log('  -', d));

  console.log('\nPackages listed in package.json but NOT imported in ./app:');
  if (declaredButNotUsed.length === 0) {
    console.log('  (none)');
  } else {
    declaredButNotUsed.forEach(d => console.log('  -', d));
  }

  console.log('\nPackages imported in ./app but NOT listed in package.json:');
  if (usedButNotDeclared.length === 0) {
    console.log('  (none)');
  } else {
    usedButNotDeclared.forEach(d => console.log('  -', d));
    console.log('\n  These may be peer dependencies, local packages, or missing entries in package.json.');
  }

  // Also write a JSON report to disk
  const outPath = path.join(ROOT, 'dependency-usage-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nFull JSON report written to ${outPath}`);

  // exit successfully
  process.exit(0);
}

main();
