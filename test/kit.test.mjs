// Tests for architecture-kit. Run: npm test
// The render test needs d2 and the headless browser (`architecture-kit setup`); it is skipped without them.

import { LikeC4 } from 'likec4'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { check } from '../lib/check.mjs'
import { deploymentViewToD2 } from '../lib/d2.mjs'
import { DEFAULT_KIT_SOURCE, init, KIT_VERSION } from '../lib/init.mjs'
import { hasD2, render } from '../lib/render.mjs'
import { findProjects, findWorkspace } from '../lib/workspace.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const example = path.join(root, 'examples', 'k8s-cluster')
const tmp = mkdtempSync(path.join(os.tmpdir(), 'architecture-kit-test-'))
after(() => rmSync(tmp, { recursive: true, force: true }))

/** Copy of the example in tmp, with the spec next to it so the relative include still resolves. */
function exampleCopy(name) {
  const dir = path.join(tmp, name)
  cpSync(path.join(root, 'spec'), path.join(dir, 'spec'), { recursive: true })
  cpSync(example, path.join(dir, 'examples', 'k8s-cluster'), {
    recursive: true,
    filter: src => !src.includes(`${path.sep}renders`) && !src.includes(`${path.sep}.cache`),
  })
  return path.join(dir, 'examples', 'k8s-cluster')
}

const quiet = () => {
  const lines = []
  return { log: line => lines.push(line), lines }
}

describe('check', () => {
  test('the example model passes', async () => {
    const out = quiet()
    assert.equal(await check(example, out), true, out.lines.join('\n'))
  })

  test('semantic rules report broken models', async () => {
    const ws = exampleCopy('broken')
    const deployment = path.join(ws, 'model', 'deployment.c4')
    writeFileSync(deployment, readFileSync(deployment, 'utf8')
      .replace("ip '10.10.0.2/24'", "ip '10.20.0.2/24'") // tunnel ends in different subnets
      .replace("ip '198.51.100.22/24'", "ip '203.0.113.11/24'")) // duplicate address
    writeFileSync(path.join(ws, 'model', 'broken.c4'), `
model {
  orphan = service 'Orphan'
  k8s.ingress -> k8s.etcd
}
deployment {
  extend server1.vm {
    bad = nic 'bad' {
      description 'address without prefix'
      metadata {
        ip '10.10.0.9'
      }
    }
  }
  server1.vm.node.workloads -[overlay]-> server2.vm.node.etcd 'no tunnel named'
}
views {
  dynamic view brokenFlow {
    title 'Broken'
    k8s.workloads -> k8s.etcd 'not in the model'
  }
}
`)
    const out = quiet()
    assert.equal(await check(ws, out), false)
    const text = out.lines.join('\n')
    for (const expected of [
      'element orphan: has no description',
      "relationship k8s.ingress -> k8s.etcd: has no title",
      "step k8s.workloads -> k8s.etcd 'not in the model' has no matching relationship",
      "ip '10.10.0.9' must be address/prefix",
      'ip 203.0.113.11/24 is also used by',
      'tunnel endpoints are not in the same subnet',
      'is overlay traffic but has no technology',
    ]) {
      assert.ok(text.includes(expected), `missing "${expected}" in:\n${text}`)
    }
  })
})

describe('d2 layout rules', async () => {
  const likec4 = await LikeC4.fromWorkspace(example, { logger: false })
  const view = (await likec4.computedModel('k8s-cluster')).view('network')
  const d2 = await deploymentViewToD2(view, path.join(tmp, 'icons'))
  after(() => likec4.dispose())

  // The block of a top-level twin inside row_twins, with labels removed and ids normalized
  const twinBlock = id => {
    const start = d2.indexOf(`  ${id}: `)
    const end = d2.indexOf('\n  }\n', start)
    return d2.slice(start, end).replace(/"[^"]*"/g, '""').replaceAll(id, 'TWIN')
  }

  test('identical servers are placed side by side as twins', () => {
    assert.match(d2, /row_twins: "" \{\n {2}grid-columns: 2/)
    assert.equal(twinBlock('server1'), twinBlock('server2'))
  })

  test('twins get their internal edges in the same order', () => {
    const internal = id => d2.split('\n')
      .filter(l => l.startsWith(`row_twins.${id}.`) && l.includes(` row_twins.${id}.`))
      .map(l => l.replace(/:.*$/, '').replaceAll(id, 'TWIN'))
    assert.ok(internal('server1').length > 0)
    assert.deepEqual(internal('server1'), internal('server2'))
  })

  test('cluster traffic is routed through the tunnel: only the tunnel crosses between the servers', () => {
    const crossing = d2.split('\n').filter(l => /^row_twins\.server1\S* \S+ row_twins\.server2/.test(l))
    assert.equal(crossing.length, 1, crossing.join('\n'))
    assert.match(crossing[0], /wg0 <-> row_twins\.server2\.\S*wg0: "WireGuard tunnel[^"]*carries:/)
  })
})

describe('init', () => {
  test('scaffolds .architecture-kit/ with the kit pinned to this version', () => {
    const repo = path.join(tmp, 'my-repo')
    const out = quiet()
    const ws = init(repo, { name: 'my-repo', title: 'My Repo', install: false, log: out.log })
    assert.equal(ws, path.join(repo, '.architecture-kit'))
    const pkg = JSON.parse(readFileSync(path.join(ws, 'package.json'), 'utf8'))
    assert.equal(pkg.devDependencies['architecture-kit'], `github:Frank-Reichenbach/architecture-kit#v${KIT_VERSION}`)
    assert.equal(DEFAULT_KIT_SOURCE, pkg.devDependencies['architecture-kit'])
    const config = JSON.parse(readFileSync(path.join(ws, 'likec4.config.json'), 'utf8'))
    assert.deepEqual(config.include.paths, ['node_modules/architecture-kit/spec'])
    assert.ok(existsSync(path.join(ws, 'model', 'overview.c4')))
    assert.equal(findWorkspace(repo), ws)
    assert.deepEqual(findProjects(ws).map(p => p.name), ['my-repo'])
    assert.throws(() => init(repo, { install: false, log: out.log }), /already initialized/)
  })
})

const canRender = hasD2() && (() => {
  try {
    execFileSync(process.execPath, [path.join(root, 'node_modules', 'playwright', 'cli.js'), 'install', '--only-shell', '--dry-run', 'chromium'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

describe('plugin', () => {
  const skills = ['architecture', 'init', 'review']

  test('skills only run when the user calls them', () => {
    for (const skill of skills) {
      const text = readFileSync(path.join(root, 'skills', skill, 'SKILL.md'), 'utf8')
      const frontmatter = text.split('---')[1]
      assert.match(frontmatter, /^disable-model-invocation: true$/m, `${skill} must not be model-invoked`)
    }
  })

  test('skills point to the shared guide, which ends with the final message', () => {
    for (const skill of skills) {
      const text = readFileSync(path.join(root, 'skills', skill, 'SKILL.md'), 'utf8')
      assert.ok(text.includes('${CLAUDE_PLUGIN_ROOT}/guide/modelling.md'), `${skill} must read the guide`)
      assert.match(text, /final message/i, `${skill} must end with the final message`)
    }
    const guide = readFileSync(path.join(root, 'guide', 'modelling.md'), 'utf8')
    assert.match(guide, /## Final message to the user \(mandatory\)/)
  })

  test('manifests agree on name and version', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
    const plugin = JSON.parse(readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'))
    const marketplace = JSON.parse(readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'))
    assert.equal(plugin.name, pkg.name)
    assert.equal(plugin.version, pkg.version)
    assert.deepEqual(marketplace.plugins.map(p => p.name), [plugin.name])
  })
})

describe('render', { skip: !canRender && 'needs d2 and the headless browser' }, () => {
  test('renders every view and writes the review index', async () => {
    const ws = exampleCopy('render')
    const out = quiet()
    assert.equal(await render(ws, out), true, out.lines.join('\n'))
    for (const file of ['index.jpg', 'clusterComponents.jpg', 'network.png', 'clusterTraffic.png', 'README.md']) {
      assert.ok(existsSync(path.join(ws, 'renders', file)), `missing renders/${file}`)
    }
    assert.ok(out.lines.some(l => l.includes('network.png (twins in columns')), out.lines.join('\n'))
  })
})
