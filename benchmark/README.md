# Benchmark: Vapor vs Classic Build Comparison

This directory contains tooling to track Vue Vapor's production bundle size over time, comparing it against the classic Vue 3 runtime.

## Quick Start

```bash
# Run production benchmark (recommended)
npm run benchmark

# Generate readable build for inspection (no metrics stored)
npm run benchmark:inspect
```

## How It Works

The benchmark script:
1. Builds the Vapor version from `example/src` in production mode
2. Temporarily transforms components to use classic Vue runtime
3. Builds the classic version
4. Compares raw and gzipped sizes
5. Stores results in `results/build-history.json`
6. Restores Vapor sources
7. Generates `artifacts/report.md` with trends

## Understanding the Modes

### Production Benchmark (`npm run benchmark`)
- **Purpose**: Track real production bundle sizes over time
- **Build**: Minified, optimized, production Vite config
- **Output**: Stored in `results/build-history.json` (committed to git)
- **When to use**: Regularly, especially after changes to see impact

### Inspection Mode (`npm run benchmark:inspect`)
- **Purpose**: Examine compiled output for debugging
- **Build**: No minification, source maps, preserved modules
- **Output**: Not stored in history (one-time inspection)
- **When to use**: When debugging Vapor vs Classic differences

## Interpreting Results

### Current Build Section
Shows latest benchmark with:
- **Raw size**: Uncompressed bundle size
- **Gzipped size**: What users actually download (primary metric)
- **Compression ratio**: How well the code compresses
- **Delta**: Difference between Vapor and Classic

### Recent History Section
Shows last 10 benchmarks with:
- **Trend indicators**:
  - ↓ Improving: Bundle size decreased >100 bytes
  - ↑ Regressing: Bundle size increased >100 bytes
  - → Stable: Within 100 bytes

### Current Expectations (Vue 3.6 alpha)

**Alpha State:**
- Vapor still includes `@vue/runtime-vapor` runtime (~50-60 KB raw)
- Classic includes `@vue/runtime-core` + `@vue/runtime-dom`
- Current: Vapor ~21 KB gzipped (58 KB raw), Classic ~26 KB gzipped (65 KB raw)

**Stable Goals:**
- Vapor-only bundle: ~10 KB gzipped (~30 KB raw) baseline
- No Virtual DOM runtime included
- Significant reduction expected when Vue 3.6 reaches stable

## Files Modified During Comparison

The script temporarily modifies:
- `example/src/main.ts` - swaps `createVaporApp` → `createApp`
- `example/src/App.vue` - removes `vapor` attribute
- `example/src/components/HelloWorld.vue` - removes `vapor` attribute

All changes are automatically restored after comparison.

## Output Structure

```
benchmark/
├── scripts/
│   └── compare-builds.mjs    # Benchmark script
├── results/
│   └── build-history.json    # Historical data (committed)
├── artifacts/                # Latest build output (gitignored)
│   ├── vapor/
│   ├── classic/
│   └── report.md
└── README.md
```

## Best Practices

1. **Run benchmarks regularly**: After significant changes, before releases
2. **Commit history**: The `build-history.json` file is tracked in git
3. **Watch for trends**: Look for gradual regressions over time
4. **Version tracking**: Vue version is recorded for each benchmark
5. **Focus on gzipped**: That's what users download

## Future Enhancements

Consider adding:
- Brotli compression (typically 15-25% smaller than gzip)
- File count tracking
- Largest file identification
- CI/CD integration for automated benchmarks
- Visual charts from history data
