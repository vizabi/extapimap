import * as d3 from "d3";
const clamp0to1 = (n) => n > 1 ? 1 : (n < 0 ? 0 : n);

export function quantize(encoding, value, nSteps) {
  const scale = encoding.scale.d3Scale;
  const zoomed = encoding.scale.zoomed;
  const range = [scale(zoomed[0]), scale(zoomed[1])];
  const upsideDown = range[0] > range[1];
  const valueScaled0to1 = clamp0to1((scale(value) - d3.min(range)) / (d3.max(range) - d3.min(range)));
  const index = Math.round((upsideDown ? 1 - valueScaled0to1 : valueScaled0to1) * (nSteps - 1));
  return index;
}

export const bivariatePalettes = {
  "GnPu": ["#e8e8e8", "#dce8dc", "#cfe8d0", "#c1e8c2", "#b0e8b1", "#00e804", "#e4c8e8", "#dcc8dc", "#cfc8d0", "#c1c8c2", "#b0c8b1", "#00c804", "#e0a7e8", "#dca7dc", "#cfa7d0", "#c1a7c2", "#b0a7b1", "#00a704", "#dc83e8", "#dc83dc", "#cf83d0", "#c183c2", "#b083b1", "#008304", "#d758e8", "#d758dc", "#cf58d0", "#c158c2", "#b058b1", "#005804", "#cc00e8", "#cc00dc", "#cc00d0", "#c100c2", "#b000b1", "#000004"],
  "BlPu": ["#e8e8e8", "#cae6e6", "#a9e4e4", "#82e1e1", "#50dede", "#00d9d9", "#e3c5dd", "#cac5dd", "#a9c5dd", "#82c5dd", "#50c5dd", "#00c5d9", "#dfa1d2", "#caa1d2", "#a9a1d2", "#82a1d2", "#50a1d2", "#00a1d2", "#d97bc7", "#ca7bc7", "#a97bc7", "#827bc7", "#507bc7", "#007bc7", "#d34eb9", "#ca4eb9", "#a94eb9", "#824eb9", "#504eb9", "#004eb9", "#c900a1", "#c900a1", "#a900a1", "#8200a1", "#5000a1", "#0000a1"],
};

export function colorScaleLogic({context, typicalColorEnc, missing, color, x, y}) {
  context.MDL.x.scale.zoomed;
  context.MDL.y.scale.zoomed;

  const isMeasure = enc => context.MDL[enc].data.conceptProps.concept_type === "measure";

  const bivariatePalette = bivariatePalettes[context.ui.map.bivariateColorPalette];
  const nSteps = Math.sqrt(bivariatePalette.length);


  // bivariate scale disabled — revert to regular color encoding
  if (!context.ui.map.useBivariateColorScaleWithDataFromXY)
    return color || color === 0 ? context.MDL[typicalColorEnc].scale.d3Scale(color) : missing;
    
  // one of x or y doesn't have data or both aren't measures
  else if ( !x && x !== 0 || !y && y !== 0 || !isMeasure("x") && !isMeasure("y"))
    return missing;

  // y is not a measure — univariate scale
  else if ( isMeasure("x") && !isMeasure("y") ) {
    return bivariatePalette[quantize(context.MDL["x"], x, nSteps)];
  }

  // x is not a measure — univariate scale
  else if ( !isMeasure("x") && isMeasure("y") ) {
    return bivariatePalette[quantize(context.MDL["y"], y, nSteps) * nSteps];
  }

  // both x and y are measures and have data — actual bivariate scale
  else {
    return bivariatePalette[quantize(context.MDL["x"], x, nSteps) + quantize(context.MDL["y"], y, nSteps) * nSteps];
  }
  
}


