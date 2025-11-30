#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

interface BenchmarkEntry {
  timestamp: string
  mode: 'benchmark' | 'inspect'
  vapor: {
    raw: number
    gzipped: number
  }
  classic: {
    raw: number
    gzipped: number
  }
  delta: {
    raw: number
    gzipped: number
  }
  vueVersion: string
}

interface BenchmarkHistory {
  benchmarks: BenchmarkEntry[]
}

interface PackageJson {
  dependencies: {
    vue: string
    [key: string]: string
  }
  [key: string]: unknown
}

interface PathConfig {
  dist: string
  artifacts: string
  vapor: string
  classic: string
  report: string
  history: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration & Constants
// ─────────────────────────────────────────────────────────────────────────────

const __dirname: string = fileURLToPath(new URL('.', import.meta.url))
const root: string = path.resolve(__dirname, '../..')
const isInspectMode: boolean = process.argv.includes('--inspect')

const artifactsDir: string = path.join(root, 'benchmark/artifacts')
const historyFile: string = path.join(root, 'benchmark/results/build-history.json')

/** Byte threshold for determining trend direction in reports */
const TREND_THRESHOLD_BYTES = 100

/** Number of recent benchmarks to display in history table */
const HISTORY_DISPLAY_LIMIT = 10

const paths: PathConfig = {
  dist: path.join(root, 'dist'),
  artifacts: artifactsDir,
  vapor: path.join(artifactsDir, 'vapor'),
  classic: path.join(artifactsDir, 'classic'),
  report: path.join(artifactsDir, 'report.md'),
  history: historyFile
}

const trackedFiles: string[] = [
  'example/src/main.ts',
  'example/src/App.vue',
  'example/src/components/HelloWorld.vue',
]

const originals: Map<string, string> = new Map()
for (const rel of trackedFiles) {
  originals.set(rel, read(rel))
}

// ─────────────────────────────────────────────────────────────────────────────
// File System Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a file relative to project root
 * @param relPath - Path relative to project root
 * @returns File contents as string
 */
function read(relPath: string): string {
  return readFileSync(path.join(root, relPath), 'utf8')
}

/**
 * Write content to a file relative to project root
 * @param relPath - Path relative to project root
 * @param content - Content to write
 */
function write(relPath: string, content: string): void {
  writeFileSync(path.join(root, relPath), content)
}

function cleanDist(): void {
  rmSync(paths.dist, { recursive: true, force: true })
}

/**
 * Execute the Vite build process
 * Uses 'build' script in inspect mode (readable output)
 * Uses 'build:ship' script in benchmark mode (minified)
 */
function runBuild(): void {
  const buildScript = isInspectMode ? 'build' : 'build:ship'
  execSync(`npm run ${buildScript}`, { cwd: root, stdio: 'inherit' })
}

function captureOutput(targetDir: string): void {
  mkdirSync(paths.artifacts, { recursive: true })
  rmSync(targetDir, { recursive: true, force: true })
  renameSync(paths.dist, targetDir)
}

// ─────────────────────────────────────────────────────────────────────────────
// Source Transformation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove the 'vapor' attribute from Vue SFC script tags
 * Transforms `<script setup vapor>` to `<script setup>`
 * @param source - Vue SFC source code
 * @returns Transformed source without vapor attribute
 */
function stripVaporAttribute(source: string): string {
  return source.replace(/<script\s+setup[^>]*?>/, (match) =>
    match.replace(/\s+vapor(?=\s|>)/, '')
  )
}

/**
 * Transform source files from Vapor mode to Classic Vue mode
 * Modifies main.ts to use createApp instead of createVaporApp
 * Strips vapor attribute from all Vue SFCs
 * @warning This modifies source files - always call restoreSources() after
 */
function applyClassicTransforms(): void {
  write(
    'example/src/main.ts',
    [
      "import './style.css'",
      "import { createApp } from 'vue'",
      "import App from './App.vue'",
      '',
      '// Classic Vue runtime build used for comparisons.',
      "createApp(App).mount('#app')",
      '',
    ].join('\n')
  )

  for (const file of [
    'example/src/App.vue',
    'example/src/components/HelloWorld.vue'
  ]) {
    write(file, stripVaporAttribute(read(file)))
  }
}

function restoreSources(): void {
  for (const [file, content] of originals) {
    write(file, content)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Size Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate total size of all files in a directory (recursive)
 * @param dir - Directory path to measure
 * @returns Total size in bytes
 */
function directorySize(dir: string): number {
  let total: number = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath: string = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += directorySize(fullPath)
    } else if (entry.isFile()) {
      total += statSync(fullPath).size
    }
  }
  return total
}

/**
 * Calculate gzipped size of all files in a directory (recursive)
 * Compresses each file individually and sums the results
 * @param dir - Directory path to measure
 * @returns Total gzipped size in bytes
 */
function gzipDirectorySize(dir: string): number {
  let total: number = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath: string = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += gzipDirectorySize(fullPath)
    } else if (entry.isFile()) {
      const data: Buffer = readFileSync(fullPath)
      total += gzipSync(data).length
    }
  }
  return total
}

/**
 * Format bytes as kilobytes with one decimal place
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "21.5 KB")
 */
function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

// ─────────────────────────────────────────────────────────────────────────────
// Version Management
// ─────────────────────────────────────────────────────────────────────────────

function getVueVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as PackageJson
    return packageJson.dependencies.vue.replace(/[\^~]/g, '')
  } catch {
    return 'unknown'
  }
}

function readHistory(): BenchmarkHistory {
  try {
    return JSON.parse(readFileSync(paths.history, 'utf8')) as BenchmarkHistory
  } catch {
    return { benchmarks: [] }
  }
}

/**
 * Parse semantic version string into comparable parts
 */
function parseVersion(version: string): {
  major: number
  minor: number
  patch: number
  prerelease: string | null
  prereleaseNum: number
} {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/)
  if (!match) {
    return { major: 0, minor: 0, patch: 0, prerelease: null, prereleaseNum: 0 }
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    prereleaseNum: match[5] ? parseInt(match[5], 10) : 0,
  }
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a)
  const vB = parseVersion(b)

  // Compare major.minor.patch
  if (vA.major !== vB.major) return vA.major - vB.major
  if (vA.minor !== vB.minor) return vA.minor - vB.minor
  if (vA.patch !== vB.patch) return vA.patch - vB.patch

  // If one has prerelease and the other doesn't, stable version is greater
  if (vA.prerelease === null && vB.prerelease !== null) return 1
  if (vA.prerelease !== null && vB.prerelease === null) return -1

  // Both have prereleases, compare them
  if (vA.prerelease !== null && vB.prerelease !== null) {
    const prereleaseOrder: Record<string, number> = { alpha: 1, beta: 2, rc: 3 }
    const orderA = prereleaseOrder[vA.prerelease] || 0
    const orderB = prereleaseOrder[vB.prerelease] || 0

    if (orderA !== orderB) return orderA - orderB
    return vA.prereleaseNum - vB.prereleaseNum
  }

  return 0
}

// ─────────────────────────────────────────────────────────────────────────────
// History Management
// ─────────────────────────────────────────────────────────────────────────────

function writeHistory(entry: BenchmarkEntry): void {
  const history: BenchmarkHistory = readHistory()

  // Remove all existing entries with this vueVersion
  history.benchmarks = history.benchmarks.filter(
    (b: BenchmarkEntry) => b.vueVersion !== entry.vueVersion
  )

  // Add the new entry
  history.benchmarks.push(entry)

  // Sort by semantic version
  history.benchmarks.sort((a: BenchmarkEntry, b: BenchmarkEntry) =>
    compareVersions(a.vueVersion, b.vueVersion)
  )

  writeFileSync(paths.history, JSON.stringify(history, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a markdown benchmark report with current results and history
 * @param current - Current benchmark entry
 * @param history - Historical benchmark data for trend analysis
 * @returns Formatted markdown string
 */
function generateMarkdownReport(current: BenchmarkEntry, history: BenchmarkHistory): string {
  const timestamp: string = new Date(current.timestamp).toLocaleString()
  const delta: number = current.delta.gzipped
  const deltaLabel: string = delta === 0
    ? '0 KB (equal)'
    : `${delta > 0 ? '+' : ''}${formatKB(Math.abs(delta))} (${delta > 0 ? 'Vapor larger' : 'Vapor smaller'})`

  let markdown: string[] = [
    `# Build Benchmark Report`,
    ``,
    `**Generated**: ${timestamp}`,
    `**Vue Version**: ${current.vueVersion}`,
    `**Mode**: ${current.mode === 'inspect' ? 'Inspection (readable)' : 'Production benchmark'}`,
    ``,
    `## Current Build`,
    ``,
    `| Build | Raw Size | Gzipped | Compression Ratio |`,
    `|-------|----------|---------|-------------------|`,
    `| Vapor | ${formatKB(current.vapor.raw)} (${current.vapor.raw.toLocaleString()} bytes) | ${formatKB(current.vapor.gzipped)} (${current.vapor.gzipped.toLocaleString()} bytes) | ${(current.vapor.raw / current.vapor.gzipped).toFixed(2)}x |`,
    `| Classic | ${formatKB(current.classic.raw)} (${current.classic.raw.toLocaleString()} bytes) | ${formatKB(current.classic.gzipped)} (${current.classic.gzipped.toLocaleString()} bytes) | ${(current.classic.raw / current.classic.gzipped).toFixed(2)}x |`,
    ``,
    `**Delta (Vapor - Classic)**: ${deltaLabel}`,
  ]

  // Add history section if not in inspect mode
  if (current.mode !== 'inspect' && history.benchmarks.length > 0) {
    markdown.push(``, `## Recent History`, ``)

    const recentBenchmarks: BenchmarkEntry[] = history.benchmarks
      .filter((b: BenchmarkEntry) => b.mode === 'benchmark')
      .slice(-HISTORY_DISPLAY_LIMIT)
      .reverse()

    if (recentBenchmarks.length > 0) {
      markdown.push(
        `| Date | Vue Version | Vapor (gzipped) | Classic (gzipped) | Delta | Trend |`,
        `|------|-------------|-----------------|-------------------|-------|-------|`
      )

      recentBenchmarks.forEach((entry: BenchmarkEntry, idx: number) => {
        const date: string = new Date(entry.timestamp).toLocaleDateString()
        const vaporGzip: string = formatKB(entry.vapor.gzipped)
        const classicGzip: string = formatKB(entry.classic.gzipped)
        const entryDelta: number = entry.delta.gzipped
        const deltaStr: string = entryDelta > 0 ? `+${formatKB(entryDelta)}` : formatKB(entryDelta)

        // Calculate trend
        let trend: string = '—'
        if (idx < recentBenchmarks.length - 1) {
          const prev: BenchmarkEntry = recentBenchmarks[idx + 1]
          const change: number = entry.vapor.gzipped - prev.vapor.gzipped
          if (change < -TREND_THRESHOLD_BYTES) trend = '↓ Improving'
          else if (change > TREND_THRESHOLD_BYTES) trend = '↑ Regressing'
          else trend = '→ Stable'
        }

        markdown.push(`| ${date} | ${entry.vueVersion} | ${vaporGzip} | ${classicGzip} | ${deltaStr} | ${trend} |`)
      })
    }
  }

  markdown.push(
    ``,
    `## Commands`,
    ``,
    `\`\`\`bash`,
    `npm run benchmark         # Run production benchmark`,
    `npm run benchmark:inspect # Generate readable build for inspection`,
    `\`\`\``,
    ``
  )

  return markdown.join('\n')
}

/**
 * Create benchmark entry, update history, and write markdown report
 * @param vaporSize - Raw Vapor build size in bytes
 * @param classicSize - Raw Classic build size in bytes
 * @param vaporGzip - Gzipped Vapor build size in bytes
 * @param classicGzip - Gzipped Classic build size in bytes
 */
function writeReport(vaporSize: number, classicSize: number, vaporGzip: number, classicGzip: number): void {
  const entry: BenchmarkEntry = {
    timestamp: new Date().toISOString(),
    mode: isInspectMode ? 'inspect' : 'benchmark',
    vapor: {
      raw: vaporSize,
      gzipped: vaporGzip
    },
    classic: {
      raw: classicSize,
      gzipped: classicGzip
    },
    delta: {
      raw: vaporSize - classicSize,
      gzipped: vaporGzip - classicGzip
    },
    vueVersion: getVueVersion()
  }

  // Only save to history if benchmarking (not inspecting)
  if (!isInspectMode) {
    writeHistory(entry)
  }

  // Generate markdown report with history
  const markdown: string = generateMarkdownReport(entry, readHistory())

  mkdirSync(paths.artifacts, { recursive: true })
  writeFileSync(paths.report, markdown)
  console.log(`Report saved to ${path.relative(root, paths.report)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Execution
// ─────────────────────────────────────────────────────────────────────────────

let classicApplied: boolean = false

const mode: 'inspect' | 'benchmark' = isInspectMode ? 'inspect' : 'benchmark'
console.log(`Running in ${mode} mode...`)

try {
  console.log(`\nBuilding Vapor output...`)
  cleanDist()
  runBuild()
  captureOutput(paths.vapor)

  console.log(`\nBuilding classic runtime output...`)
  applyClassicTransforms()
  classicApplied = true
  cleanDist()
  runBuild()
  captureOutput(paths.classic)

  const vaporSize: number = directorySize(paths.vapor)
  const classicSize: number = directorySize(paths.classic)
  const vaporGzip: number = gzipDirectorySize(paths.vapor)
  const classicGzip: number = gzipDirectorySize(paths.classic)

  console.log(`\nSize summary (${mode})`)
  console.log(`- Vapor output:   ${formatKB(vaporSize)} (gzip ${formatKB(vaporGzip)})`)
  console.log(`- Classic output: ${formatKB(classicSize)} (gzip ${formatKB(classicGzip)})`)
  writeReport(vaporSize, classicSize, vaporGzip, classicGzip)
} finally {
  if (classicApplied) {
    console.log('\nRestoring Vapor sources and regenerating dist...')
    restoreSources()
    cleanDist()
    runBuild()
  }
}

console.log(`\nArtifacts available under ${path.relative(root, paths.vapor)} and ${path.relative(root, paths.classic)}`)
if (!isInspectMode) {
  console.log(`History updated in ${path.relative(root, paths.history)}`)
}
