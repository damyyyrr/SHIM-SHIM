import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
const root = process.cwd();
const source = path.join(root, "build-check");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const assets = {};
async function collect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) await collect(absolute);
    else if (types[path.extname(item.name)]) {
      const relative =
        "/" + path.relative(source, absolute).replaceAll(path.sep, "/");
      assets[relative] = {
        type: types[path.extname(item.name)],
        base64: (await readFile(absolute)).toString("base64"),
      };
    }
  }
}
await collect(source);
await writeFile(
  path.join(root, "worker", "assets.generated.ts"),
  `export const assets = ${JSON.stringify(assets)};\n`,
);
await mkdir(path.join(root, "dist", "server"), { recursive: true });
await build({
  entryPoints: [path.join(root, "worker", "index.ts")],
  outfile: path.join(root, "dist", "server", "index.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
});
console.log(
  `Hosted worker built with ${Object.keys(assets).length} static assets.`,
);
