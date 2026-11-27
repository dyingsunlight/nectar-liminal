import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

function collectFiles(targetPath: string, files: string[]): void {
  if (!fs.existsSync(targetPath)) {
    return
  }
  const stat = fs.statSync(targetPath)
  if (stat.isFile()) {
    files.push(targetPath)
    return
  }
  if (!stat.isDirectory()) {
    return
  }
  const entries = fs.readdirSync(targetPath, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.DS_Store'
    ) {
      continue
    }
    collectFiles(path.join(targetPath, entry.name), files)
  }
}

export function hashPaths(pathsToHash: string[]): string {
  const hash = crypto.createHash('sha256')
  const files: string[] = []
  for (const target of pathsToHash) {
    collectFiles(target, files)
  }
  files.sort()
  for (const filePath of files) {
    hash.update(filePath)
    hash.update(fs.readFileSync(filePath))
  }
  return hash.digest('hex')
}
