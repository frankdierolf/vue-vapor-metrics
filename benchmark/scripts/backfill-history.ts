#!/usr/bin/env node

/**
 * Backfill historical benchmark data for all Vue 3.6 alpha releases.
 * Queries npm for available versions, skips already benchmarked ones,
 * and runs benchmarks for each missing version chronologically.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const __dirname: string = fileURLToPath(new URL('.', import.meta.url))
const root: string = path.resolve(__dirname, '../..')
const historyFile: string = path.join(root, 'benchmark/results/build-history.json')

interface BenchmarkEntry {
  vueVersion: string
  [key: string]: unknown
}

interface BenchmarkHistory {
  benchmarks: BenchmarkEntry[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Version Utilities (copied from compare-builds.ts for independence)
// ─────────────────────────────────────────────────────────────────────────────

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

function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a)
  const vB = parseVersion(b)

  if (vA.major !== vB.major) return vA.major - vB.major
  if (vA.minor !== vB.minor) return vA.minor - vB.minor
  if (vA.patch !== vB.patch) return vA.patch - vB.patch

  if (vA.prerelease === null && vB.prerelease !== null) return 1
  if (vA.prerelease !== null && vB.prerelease === null) return -1

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
// Core Functions
// ─────────────────────────────────────────────────────────────────────────────

function getAlphaVersionsFromNpm(): string[] {
  console.log('Fetching Vue 3.6 alpha versions from npm...')
  const output = execSync('npm info vue versions --json', { encoding: 'utf8' })
  const allVersions: string[] = JSON.parse(output)
  return allVersions
    .filter((v: string) => v.startsWith('3.6.0-alpha'))
    .sort(compareVersions)
}

function readHistory(): BenchmarkHistory {
  try {
    return JSON.parse(readFileSync(historyFile, 'utf8')) as BenchmarkHistory
  } catch {
    return { benchmarks: [] }
  }
}

function getExistingVersions(): Set<string> {
  const history = readHistory()
  return new Set(history.benchmarks.map((b) => b.vueVersion))
}

function installVersion(version: string): void {
  console.log(`\nInstalling vue@${version}...`)
  execSync(`npm install vue@${version}`, { cwd: root, stdio: 'inherit' })
}

function runBenchmark(): boolean {
  console.log('Running benchmark...')
  try {
    execSync('npm run benchmark', { cwd: root, stdio: 'inherit' })
    return true
  } catch {
    console.error('Benchmark failed for this version')
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('='.repeat(60))
  console.log('Vue Vapor Benchmark Backfill')
  console.log('='.repeat(60))

  // Get all available alpha versions
  const allVersions = getAlphaVersionsFromNpm()
  console.log(`Found ${allVersions.length} alpha versions: ${allVersions.join(', ')}`)

  // Find versions not yet benchmarked
  const existingVersions = getExistingVersions()
  console.log(`Already benchmarked: ${existingVersions.size > 0 ? [...existingVersions].join(', ') : 'none'}`)

  const missingVersions = allVersions.filter((v) => !existingVersions.has(v))

  if (missingVersions.length === 0) {
    console.log('\nAll versions already benchmarked!')
    return
  }

  console.log(`\nMissing versions to benchmark: ${missingVersions.join(', ')}`)
  console.log(`\nStarting backfill of ${missingVersions.length} version(s)...\n`)

  const results: { version: string; success: boolean }[] = []

  // Benchmark each missing version (oldest first)
  for (let i = 0; i < missingVersions.length; i++) {
    const version = missingVersions[i]

    console.log('='.repeat(60))
    console.log(`[${i + 1}/${missingVersions.length}] Benchmarking Vue ${version}`)
    console.log('='.repeat(60))

    installVersion(version)
    const success = runBenchmark()
    results.push({ version, success })

    if (success) {
      console.log(`\nCompleted Vue ${version}\n`)
    } else {
      console.log(`\nSkipping Vue ${version} (build failed)\n`)
    }
  }

  // Report results
  const failed = results.filter(r => !r.success).map(r => r.version)
  const successCount = results.filter(r => r.success).length

  console.log(`\nBenchmarked ${successCount}/${results.length} version(s) successfully.`)
  if (failed.length > 0) {
    console.log(`Failed versions: ${failed.join(', ')}`)
    console.log('(These early alpha versions may have bugs that were fixed in later releases.)')
  }

  // Restore to latest version
  const latestVersion = allVersions[allVersions.length - 1]
  console.log('='.repeat(60))
  console.log(`Restoring to latest version: ${latestVersion}`)
  console.log('='.repeat(60))
  installVersion(latestVersion)

  console.log('\n' + '='.repeat(60))
  console.log('Backfill complete!')
  console.log(`History file updated: ${path.relative(root, historyFile)}`)
  console.log('='.repeat(60))
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
