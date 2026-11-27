import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'
import { build } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const distNodeModulesDir = path.join(distDir, 'node_modules')
const zipOutputPath = path.join(distDir, 'fc-code.zip')

const SKIP_PACKAGE_DIRS = new Set([
  'node_modules',
  'test',
  'tests',
  'doc',
  'docs',
  'img',
  'samples',
  'samples-async(node6)',
  'cli',
  'bin',
  'scripts',
])

function copyExternalPackageTree(rootRequire, rootPackageName, targetNodeModulesDir) {
  const visited = new Set()

  function visit(pkgName, fromRequire) {
    if (pkgName.startsWith('@types/') || pkgName === 'undici-types') {
      return
    }
    if (visited.has(pkgName)) {
      return
    }
    visited.add(pkgName)

    const pkgJsonPath = fromRequire.resolve(`${pkgName}/package.json`)
    const pkgDir = path.dirname(pkgJsonPath)
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    const destDir = path.join(targetNodeModulesDir, ...pkgName.split('/'))

    fs.mkdirSync(path.dirname(destDir), { recursive: true })
    fs.cpSync(pkgDir, destDir, {
      recursive: true,
      dereference: true,
      filter: (src) => {
        if (src === pkgDir) {
          return true
        }
        const relParts = path.relative(pkgDir, src).split(path.sep)
        if (SKIP_PACKAGE_DIRS.has(relParts[0])) {
          return false
        }
        if (pkgName === 'protobufjs' && relParts[0] === 'dist') {
          return false
        }
        if (
          src.endsWith('.d.ts') ||
          src.endsWith('.map') ||
          src.endsWith('.md')
        ) {
          return false
        }
        return true
      },
    })

    const nextRequire = createRequire(pkgJsonPath)
    const deps = Object.keys(pkgJson.dependencies ?? {})
    for (const dep of deps) {
      visit(dep, nextRequire)
    }
  }

  visit(rootPackageName, rootRequire)
  return Array.from(visited)
}

function createZipArchive(sourceDir, outFile) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFile)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      resolve(archive.pointer())
    })
    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)
    archive.file(path.join(sourceDir, 'index.js'), { name: 'index.js' })
    archive.directory(path.join(sourceDir, 'node_modules'), 'node_modules')
    archive.finalize()
  })
}

fs.rmSync(distDir, { recursive: true, force: true })
fs.mkdirSync(distNodeModulesDir, { recursive: true })

await build({
  entryPoints: [path.join(rootDir, 'src/fc-handler.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['tablestore'],
  outfile: path.join(distDir, 'index.js'),
  sourcemap: false,
  minify: false,
})

const requireFromProject = createRequire(path.join(rootDir, 'package.json'))
const copiedPackages = copyExternalPackageTree(
  requireFromProject,
  'tablestore',
  distNodeModulesDir
)

const zipBytes = await createZipArchive(distDir, zipOutputPath)
console.log(
  `[fc-api] Built dist/fc-code.zip (${zipBytes} bytes), external packages: ${copiedPackages.join(', ')}`
)
