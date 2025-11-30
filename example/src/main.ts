import './style.css'
import { createVaporApp } from 'vue'
import App from './App.vue'

type VaporRoot = Parameters<typeof createVaporApp>[0]

// Vapor alpha: SFCs still emit classic component types, so cast via createVaporApp root until typings land.
const RootComponent = App as unknown as VaporRoot

createVaporApp(RootComponent).mount('#app')
