import {
  Utils,
  BaseComponent,
  axisSmart,
} from "@vizabi/shared-components";
import {decorate, computed} from "mobx";
import {bivariatePalettes, quantize} from "./bivariateColorScale.js";

const wh = 20;
const margin = {top: 15, right: 20, bottom: 20, left: 30}

class BivariateColorLegend extends BaseComponent {
  constructor(config) {
    config.template = `
        <div class="vzb-cl-bivariate">
            <div> <span class="vzb-title-y"></span> <span class="vzb-value-y"></span> </div>
            <svg>
              <g class="vzb-margin-container">
                <g class="vzb-palette"></g>
                <g class="vzb-axis-x"></g>
                <g class="vzb-axis-y"></g>
                <rect class="vzb-dot-outer"></rect>
                <rect class="vzb-dot-inner"></rect>
              </g>
            </svg>
            <div> <span class="vzb-title-x"></span> <span class="vzb-value-x"></span> </div>
        </div>
    `;

    super(config);
  }


  setup(options) {
    this.DOM = {
      wrapper: this.element,
      titleY: this.element.select(".vzb-title-y"),
      titleX: this.element.select(".vzb-title-x"),
      valueY: this.element.select(".vzb-value-y"),
      valueX: this.element.select(".vzb-value-x"),
      axisY: this.element.select(".vzb-axis-y"),
      axisX: this.element.select(".vzb-axis-x"),
      svg: this.element.select("svg"),
      palette: this.element.select(".vzb-palette"),
      marginContainer: this.element.select(".vzb-margin-container"),
      dotOuter: this.element.select(".vzb-dot-outer"),
      dotInner: this.element.select(".vzb-dot-inner"),
    };
    this.xAxis = axisSmart("bottom");
    this.yAxis = axisSmart("left");
  }


  get MDL() {
    return {
      x: this.model.encoding.x,
      y: this.model.encoding.y,
      highlighted: this.model.encoding.highlighted,
    };
  }

  draw() {
    this.localise = this.services.locale.auto();
    this.addReaction(this.updateView);
    this.addReaction(this.updateHighlight);
  }

  updateView() {
    const { x, y } = this.MDL;

    const bivariatePalette = bivariatePalettes[this.root.ui.chart.map.bivariateColorPalette];
    const nSteps = Math.sqrt(bivariatePalette.length);

    

    const height = nSteps * wh ;
    const width = nSteps * wh ;

    this.yScale = this.MDL.y.scale.d3Scale.copy().domain(this.MDL.y.scale.zoomed).range([height - wh, 0]).clamp(true);
    this.xScale = this.MDL.x.scale.d3Scale.copy().domain(this.MDL.x.scale.zoomed).range([0, width - wh]).clamp(true);
    const isMeasure = enc => this.MDL[enc].data.conceptProps.concept_type === "measure";

    // GENERIC
    this.DOM.svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);
    this.DOM.marginContainer
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // AXES
    this.DOM.axisX
      .classed("vzb-hidden", !isMeasure("x"))
      .attr("transform", `translate(${wh/2},${height + 3})`)
      .call(
        d3.axisBottom(this.xScale)
          .tickValues(this.xScale.ticks().concat(this.MDL.x.scale.zoomed))
          .tickFormat((n) => this.MDL.x.scale.zoomed.includes(n) ? this.localise(n) : "")
      );

    this.DOM.axisY
      .classed("vzb-hidden", !isMeasure("y"))
      .attr("transform", `translate(${-3},${wh/2}) rotate(90)`)
      .call(
        d3.axisBottom(this.yScale)
          .tickValues(this.yScale.ticks().concat(this.MDL.y.scale.zoomed))
          .tickFormat((n) => this.MDL.y.scale.zoomed.includes(n) ? this.localise(n) : "")
      );

    // PALETTE
    this.DOM.palette
      .selectAll("rect")
      .data(bivariatePalette)
      .join("rect")
      .attr("width", wh)
      .attr("height", wh)
      .attr("x", (d,i) => (i % nSteps) * wh)
      .attr("y", (d,i) => (nSteps - Math.floor(i / nSteps) - 1) * wh)
      //opacity hack for both univariate situations
      .style("opacity", (d, i) => !isMeasure("x") && (i % nSteps !== 0) || !isMeasure("y") && (i >= nSteps) ? 0 : 1)
      .attr("fill", d => d);

    //AXIS TITLES
    this.DOM.titleY
      .classed("vzb-hidden", !isMeasure("y"))
      .text( "↑ " + Utils.getConceptName(this.MDL.y, this.localise));
    this.DOM.titleX
      .classed("vzb-hidden", !isMeasure("x"))
      .text( "→ " + Utils.getConceptName(this.MDL.x, this.localise)).style("margin-left", margin.left + "px");
  }

  updateHighlight() {
    const bivariatePalette = bivariatePalettes[this.ui.map.bivariateColorPalette];
    const nSteps = Math.sqrt(bivariatePalette.length);

    if (this.MDL.highlighted.data.filter.any() && this.MDL.highlighted.data.filter.markers.size === 1) {
      const [key] = [...this.MDL.highlighted.data.filter.markers.keys()];
      const d = this.model.dataMap.get(key);
      const x = d.x;
      const y = d.y;
      this.DOM.dotOuter
        .classed("vzb-hidden", false)
        .attr("x", quantize(this.MDL.x, d.x, nSteps) * wh)
        .attr("y", (nSteps - quantize(this.MDL.y, d.y, nSteps) - 1) * wh)
        .attr("width", wh)
        .attr("height", wh)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", "2");
      this.DOM.dotInner
        .classed("vzb-hidden", false)
        .attr("x", quantize(this.MDL.x, d.x, nSteps) * wh + 2)
        .attr("y", (nSteps - quantize(this.MDL.y, d.y, nSteps) - 1) * wh + 2)
        .attr("width", wh - 4)
        .attr("height", wh - 4)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", "2");
      
      this.DOM.valueY.text(y || y === 0 ? " " + this.localise(y) : "")
      this.DOM.valueX.text(x || x === 0 ? " " + this.localise(x) : "")

    } else {
      this.DOM.dotOuter.classed("vzb-hidden",true);
      this.DOM.dotInner.classed("vzb-hidden",true);
      this.DOM.valueY.text("");
      this.DOM.valueX.text("");
    }
  }

  
}

const decorated = decorate(BivariateColorLegend, {
  "MDL": computed
});
export { decorated as BivariateColorLegend };
