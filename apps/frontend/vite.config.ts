import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)
const require = createRequire(import.meta.url)

function resolveWorkspacePackage(name: string): string {
  return path.dirname(require.resolve(`${name}/package.json`))
}

// npm hoists dependencies to the repo root; Vite must resolve from there.
const hoistedPackages = [
  'react',
  'react-dom',
  'react-router-dom',
  '@emotion/react',
  '@emotion/styled',
  '@mui/material',
  '@mui/icons-material',
] as const

const hoistedAliases = Object.fromEntries(
  hoistedPackages.map((name) => [name, resolveWorkspacePackage(name)]),
)

export default defineConfig({
  cacheDir: path.join(repoRoot, 'node_modules/.vite/frontend'),
  resolve: {
    alias: hoistedAliases,
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  plugins: [react()],
})
