# vuevapor.watch

**Live Site:** [vuevapor.watch](http://vuevapor.watch/)

Tracking Vue Vapor Mode's bundle size evolution as it progresses toward the ~10KB gzipped target.

## What This Does

1. **Tracks Vapor's Evolution** - Monitors when Vue Vapor will drop the classic runtime and reach ~10KB
2. **Provides a Working Example** - Vue Vapor + TypeScript setup that actually works

## Quick Start

```bash
npm install
npm run dev           # Development server
npm run build         # Production build
npm run benchmark     # Compare Vapor vs Classic
```

## How It Works

A GitHub Action runs daily to:
1. Check for new Vue 3.6.x releases
2. Run benchmarks comparing Vapor vs Classic
3. Create a PR with the results

Results are displayed on [vuevapor.watch](http://vuevapor.watch/).

## Project Structure

```
vuevapor-watch/
├── example/           # Vapor example app with TypeScript
├── benchmark/         # Build comparison tooling
├── docs/              # Website (GitHub Pages)
└── .github/workflows/ # Automation
```

## Why Bundle Sizes Are Still Large

During alpha, Vue is porting features into Vapor mode. Once complete, Vapor-only apps will drop the Virtual DOM runtime (`@vue/runtime-core`, `@vue/runtime-dom`) and reach the ~10KB target.

## Vapor Example

```vue
<script setup vapor lang="ts">
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <HelloWorld msg="Vite + Vue" />
</template>
```

```typescript
// main.ts
import { createVaporApp } from 'vue'
import App from './App.vue'

createVaporApp(App as any).mount('#app')
```

## Repository Settings

For automated PRs, enable in GitHub: **Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests"**

## Resources

- [Vue Vapor RFC](https://github.com/vuejs/rfcs/discussions/502)
- [Benchmark History](benchmark/results/build-history.json)
- [Benchmark Details](benchmark/README.md)

## License

MIT
