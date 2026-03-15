# 3D Models

Models are optimized for web delivery using glTF-Transform.

## Optimization (run when adding new models)

```bash
npx @gltf-transform/cli optimize input.glb output.glb --compress quantize --texture-compress webp --texture-size 512
```

## Load performance

- **SplashGate** prefetches models during the splash animation so they're cached when the world loads.
- **Compatible models**: Current models use `optimize-models-compatible` (no mesh quantization) for Three.js r128. If you see `Cannot read properties of null (reading 'array')`, run `pnpm run optimize-models-compatible`.
- **Smaller models**: `optimize-models` uses quantize for smaller files but requires a newer Three.js; `optimize-models-aggressive` further reduces Castle size.

## Current sizes (compatible build)

| Model | Size |
|-------|------|
| CastleModel.glb | ~7 MB |
| furnace.glb | ~720 KB |
| RobotExpressive.glb | ~370 KB |
| filecoin_model.glb | ~460 KB |

Originals backed up in `_original/` if restoration is needed.
