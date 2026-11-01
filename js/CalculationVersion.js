export const CALCULATION_VERSION='qs-19.0-core1';
export function calculationKey(s){return JSON.stringify([s.inputs,s.points,s.openings||[],s.edgeTypes,s.manualJointsMap||{},s.jointConfig,s.presetName,s.presetColor,s.productRules]);}
export function currentResult(z){return !z.savedState||z.stats?.accessories?.calculationVersion===CALCULATION_VERSION&&z.stats.accessories.calculationKey===calculationKey(z.savedState);}
