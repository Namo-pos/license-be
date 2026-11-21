import { build } from 'esbuild';
import { builtinModules } from 'node:module';
import { copyFile, mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

// Resolve Node package entry points, including iconv-lite's stream helpers.
// Browser field substitutions disable those helpers even under nodejs_compat.
await build({
  entryPoints: ['src/worker.ts'],
  outfile: 'dist/worker/worker.js',
  bundle: true,
  format: 'esm',
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire("file:///worker.js");' },
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['workerd', 'worker'],
  external: ['cloudflare:*', 'node:*', ...builtinModules],
  plugins: [{
    name: 'worker-wasm-modules',
    setup(builder) {
      builder.onResolve({ filter: /\.wasm$/ }, async (args) => {
        const source = resolve(args.resolveDir, args.path);
        await mkdir('dist/worker', { recursive: true });
        await copyFile(source, resolve('dist/worker', basename(source)));
        // Wrangler imports .wasm as a compiled module, not an asset URL.
        return { path: './' + basename(source), external: true };
      });
    },
  }],
  define: { 'import.meta.url': JSON.stringify('file:///worker.js') },
  target: 'es2022',
});
