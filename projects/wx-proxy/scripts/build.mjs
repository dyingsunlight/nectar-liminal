import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

fs.rmSync(distDir, { recursive: true, force: true })
fs.mkdirSync(distDir, { recursive: true })

await build({
  entryPoints: [path.join(rootDir, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  external: ['wx-server-sdk'],
  outfile: path.join(distDir, 'index.js'),
  sourcemap: false,
  minify: false,
})

const functionPackageJson = {
  name: 'apiProxy',
  version: '1.0.0',
  main: 'index.js',
  dependencies: {
    'wx-server-sdk': '~2.6.3',
  },
}

const functionConfigJson = {
  permissions: {
    openapi: [],
  },
}

fs.writeFileSync(
  path.join(distDir, 'package.json'),
  `${JSON.stringify(functionPackageJson, null, 2)}\n`,
  'utf8'
)

fs.writeFileSync(
  path.join(distDir, 'config.json'),
  `${JSON.stringify(functionConfigJson, null, 2)}\n`,
  'utf8'
)

console.log('[wx-proxy] Built dist/index.js for WeChat Cloud Function deployment')
