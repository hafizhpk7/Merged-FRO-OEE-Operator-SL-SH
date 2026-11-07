import { buildAutoSealer } from "./buildAutoSealer";
import { buildBlister } from "./buildBlister";
import { buildCapping } from "./buildCapping";
import { buildCartoning } from "./buildCartoning";
import { buildCaseSealer } from "./buildCaseSealer";
import { buildCelloWrap } from "./buildCelloWrap";
import { buildFeeder } from "./buildFeeder";
import { buildFilling } from "./buildFilling";
import { buildLabelling } from "./buildLabelling";
import { buildPouch } from "./buildPouch";
import { buildShrink } from "./buildShrink";
import { buildTubeRepack } from "./buildTubeRepack";
import { resolveModelKey, selfCheckJ2Models, MODEL_REGISTRY } from "./registry";
import type { ModelBuilderOptions, ModelInstance, ModelKey } from "./types";

export * from "./types";
export * from "./registry";
export * from "./materials";

export const MODEL_BUILDERS: Record<ModelKey, (options?: ModelBuilderOptions) => ModelInstance> = {
  filling: buildFilling,
  capping: buildCapping,
  labelling: buildLabelling,
  shrink: buildShrink,
  autoSealer: buildAutoSealer,
  cartoning: buildCartoning,
  celloWrap: buildCelloWrap,
  tubeRepack: buildTubeRepack,
  caseSealer: buildCaseSealer,
  blister: buildBlister,
  pouch: buildPouch,
  feeder: buildFeeder,
};

export function buildMachineModel(
  modelKey: ModelKey | string,
  options: ModelBuilderOptions = {},
): ModelInstance {
  const resolvedKey = (
    modelKey in MODEL_BUILDERS ? modelKey : resolveModelKey(modelKey)
  ) as ModelKey;
  const builder = MODEL_BUILDERS[resolvedKey] || buildFilling;
  return builder(options);
}

// Run self-check on import
selfCheckJ2Models();
