import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/main.js"],
  bundle: true,
  platform: "browser",
  target: "es2020",
  format: "cjs",
  external: ["obsidian"],
  loader: {
    ".jpg": "dataurl",
    ".jpeg": "dataurl",
    ".png": "dataurl",
    ".webp": "dataurl",
  },
  outfile: "main.js",
  sourcemap: false,
  treeShaking: true,
  legalComments: "none",
});
