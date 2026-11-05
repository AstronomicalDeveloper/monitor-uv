const assert = require('node:assert/strict')
const { existsSync, readdirSync } = require('node:fs')
const { resolve, join, basename } = require('node:path')
const asar = require('@electron/asar')

// Inspect a generated package without installing or launching it.
const directory = resolve(process.argv[2] || 'dist/round2/win-unpacked')
const archive = join(directory, 'resources', 'app.asar')
assert.ok(existsSync(archive), 'Build a Windows package before running this check.')
const files = asar.listPackage(archive).map((name) => name.replaceAll('\\', '/').replace(/^\//, ''))
for (const required of [
  'package.json',
  'out/main/index.js',
  'out/preload/index.js',
  'out/renderer/index.html'
]) {
  assert.ok(files.includes(required), `Missing packaged file: ${required}`)
}
for (const name of files) {
  assert.ok(
    !/^(src|tests|docs|\.git|\.agents|\.codex)(\/|$)/.test(name),
    `Unexpected project file: ${name}`
  )
  assert.ok(
    !/^database.*\.json$|^\.env(?:\.|$)|^\.npmrc$/.test(basename(name)),
    `Private configuration: ${name}`
  )
  assert.ok(!name.endsWith('.zip'), `Unexpected backup archive: ${name}`)
  assert.ok(
    !/^node_modules\/(electron|electron-builder|electron-vite)\//.test(name),
    `Development tool included: ${name}`
  )
}
const metadata = JSON.parse(asar.extractFile(archive, 'package.json').toString())
assert.equal(metadata.name, 'monitor-uv')
assert.equal(metadata.author, 'Landry Bardales Guadalupe')
assert.equal(metadata.main, './out/main/index.js')
assert.equal(metadata.devDependencies, undefined)
const nativeRoot = join(
  directory,
  'resources',
  'app.asar.unpacked',
  'node_modules',
  '@serialport',
  'bindings-cpp'
)
assert.ok(existsSync(nativeRoot), 'Missing unpacked SerialPort native dependency')
assert.ok(
  readdirSync(nativeRoot, { recursive: true }).some((name) => name.endsWith('.node')),
  'Missing SerialPort native binary'
)
assert.ok(existsSync(join(directory, 'monitor-uv.exe')))
console.log(
  `Package structure passed: ${files.length} ASAR entries, runtime files, metadata, private exclusions and SerialPort binary`
)
