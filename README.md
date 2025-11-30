# Vue Vapor Metrics

Hi, I'm Frank! 👋

I love staying up to date with Vue's latest developments, especially **Vue Vapor Mode**. This repository exists for two reasons:

## 1. Track Vapor's Evolution

I'm personally curious about **when Vue Vapor will finally drop the classic Vue runtime**.

Right now (as of Vue 3.6 alpha), Vapor mode still bundles `@vue/runtime-core` and `@vue/runtime-dom` alongside the new `@vue/runtime-vapor`. This means the bundles are larger than they will be once Vapor becomes standalone.

**The Big Question:** When will Vapor-only builds drop to the promised ~10 KB gzipped target?

You can track this progress by checking [`benchmark/results/build-history.json`](benchmark/results/build-history.json), which shows benchmark data for each Vue 3.6 release.

## 2. Working Vue Vapor + TypeScript Example

Setting up Vue Vapor with TypeScript in the current alpha isn't straightforward. I kept hitting TypeScript errors.

**The Solution:** Use only Vapor components (no mixing). This repo shows a clean setup that works without TypeScript complaints.

If you're trying to set up Vue Vapor with TypeScript, feel free to use this as a reference!

## How It Works

This repository includes:

- **Example App** (`example/`) - Minimal Vue 3.6 Vapor setup with TypeScript
- **Automated Benchmarks** - Tracks bundle sizes over time
- **GitHub Workflow** - Automatically creates PRs when new Vue 3.6 versions are released

Every time Vue releases a new 3.6.x version, a GitHub Action:
1. Creates a PR with the updated dependency
2. Runs benchmarks comparing Vapor vs Classic Vue
3. Updates the benchmark history

I can then merge the PR and watch the progress toward that magical ~10 KB target!

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run benchmarks (compares Vapor vs Classic)
npm run benchmark
```

## Current Status

**Vue Version:** 3.6.0-alpha.5

**Latest Benchmarks:**
- Vapor: ~21 KB gzipped (58 KB raw)
- Classic: ~26 KB gzipped (65 KB raw)
- **Vapor is 4.1 KB smaller** ✅

See [`benchmark/artifacts/report.md`](benchmark/artifacts/report.md) for detailed results.

## Repository Structure

```
vue-vapor-metrics/
├── example/              # Vapor example application
│   ├── src/
│   │   ├── components/   # HelloWorld.vue - reactive counter
│   │   ├── App.vue       # Root component with Vapor mode
│   │   └── main.ts       # Entry point with createVaporApp
│   └── public/           # Static assets
├── benchmark/            # Build comparison tooling
│   ├── scripts/          # TypeScript benchmark script
│   ├── results/          # build-history.json
│   └── artifacts/        # Latest benchmark reports
├── .github/workflows/    # Auto-update workflow
└── vite.config.ts        # Vite config with Vapor support
```

## What's Vapor Mode?

Vue Vapor is an opt-in compilation strategy that generates direct DOM manipulation code instead of using the Virtual DOM.

**Goals:**
- **Smaller bundles** - Target: ~10 KB gzipped (~30 KB raw)
- **Faster runtime** - Direct DOM updates without diffing
- **Same DX** - Keep using SFC and Composition API

**Alpha Status:**

The alpha still includes parts of the classic runtime for compatibility. Bundle sizes will drop significantly as Vapor matures toward stable.

## Example: Minimal Vapor Component

**Root Component** (`example/src/App.vue`)
```vue
<script setup vapor lang="ts">
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <HelloWorld msg="Vite + Vue" />
</template>
```

**Vapor Entry Point** (`example/src/main.ts`)
```typescript
import { createVaporApp } from 'vue'
import App from './App.vue'

type VaporRoot = Parameters<typeof createVaporApp>[0]
const RootComponent = App as unknown as VaporRoot

createVaporApp(RootComponent).mount('#app')
```

The type cast is a workaround.

## TypeScript Setup

**Key workaround** (`example/src/env.d.ts`)
```typescript
declare module '*.vue' {
  import type { createVaporApp } from 'vue'
  type VaporRoot = Parameters<typeof createVaporApp>[0]
  const component: VaporRoot
  export default component
}
```

**TypeScript target** (`tsconfig.app.json`)
```json
{
  "vueCompilerOptions": {
    "target": 3.6
  }
}
```

These workarounds will become unnecessary once Vue 3.6 reaches stable.

## Benchmarks

Track bundle size evolution across Vue releases:

```bash
# Production benchmark (stores results, shows trends)
npm run benchmark

# Inspection mode (readable build, no metrics stored)
npm run benchmark:inspect
```

The benchmark system:
- Compares Vapor vs Classic Vue bundle sizes
- Tracks history in `benchmark/results/build-history.json`
- One entry per Vue version (deduplicated)
- Sorted by semantic version
- Generates detailed reports in `benchmark/artifacts/`

See [`benchmark/README.md`](benchmark/README.md) for details.

## Automated Updates

The GitHub workflow (`.github/workflows/vue-release-tracker.yml`) runs daily and:

1. Checks for new Vue 3.6.x releases (alpha, beta, rc, stable)
2. Creates a PR when a new version is detected
3. Runs benchmarks automatically
4. Shows size comparison in the PR description

This keeps the repository always up to date with the latest Vue Vapor progress!

## Watch the Progress

Want to follow Vue Vapor's journey? Check out:

- **[`benchmark/results/build-history.json`](benchmark/results/build-history.json)** - Historical data for all Vue versions tested
- **[Latest Report](benchmark/artifacts/report.md)** - Current bundle sizes and trends
- **[Pull Requests](../../pulls)** - Automated PRs for new Vue releases

## Resources

- [Vue Vapor RFC](https://github.com/vuejs/rfcs/discussions/502)
- [Vue 3.6 Release Timeline](https://blog.vuejs.org/)
- [Vite Documentation](https://vite.dev/)

## License

MIT

---

**Built by Frank** • Tracking Vue Vapor's progress one release at a time 📊
