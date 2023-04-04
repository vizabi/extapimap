import "./_mapoptions.scss";
import {Dialog} from "@vizabi/shared-components";
import { runInAction } from "mobx";
import * as d3 from "d3";

/*
 * Axes dialog
 */
const mapEngines = [{
  title: "Google",
  value: "google"
}, {
  title: "Mapbox",
  value: "mapbox"
}];

const mapStyles = {
  "google": [{
    title: "Terrain",
    value: "terrain"
  }, {
    title: "Grayscale",
    value: "terrain grayscale"
  }, {
    title: "Satellite",
    value: "satellite"
  }],
  mapbox: [{
    title: "Land",
    value: "mapbox://styles/mapbox/streets-v9"
  }, {
    title: "Grayscale",
    value: "mapbox://styles/mapbox/light-v9"
  }, {
    title: "Satellite",
    value: "mapbox://styles/mapbox/satellite-v9"
  }, {
    title: "Satellite Street",
    value: "mapbox://styles/mapbox/satellite-streets-v9"
  }]
};

export class MapOptions extends Dialog {

  constructor(config){
    config.template = `
      <div class='vzb-dialog-modal'>
        <span class="thumb-tack-class thumb-tack-class-ico-pin fa" data-dialogtype="mapoptions" data-click="pinDialog"></span>
        <span class="thumb-tack-class thumb-tack-class-ico-drag fa" data-dialogtype="mapoptions" data-click="dragDialog"></span>
        <div class="vzb-dialog-title">
          <span data-localise="buttons/mapoptions"></span>
        </div>
        <div class="vzb-dialog-content">
          <div class="vzb-lmap-container vzb-lmap-layers">
            <form class="vzb-dialog-paragraph  vzb-map-layers">
              <label for="showBubblesChk"><input id="showBubblesChk" type="checkbox" name="showBubbles"><span data-localise="hints/extapimap/showBubbles"></span></label>
              <label for="showAreasChk"><input id="showAreasChk" type="checkbox" name="showAreas"><span data-localise="hints/extapimap/showAreas"><span></label>
              <label for="showMapChk"><input id="showMapChk" type="checkbox" name="showMap"><span data-localise="hints/extapimap/showMap"></span></label>
            </form>
          </div>
          <div class="vzb-lmap-container vzb-lmap-engine">
            <p class="vzb-dialog-sublabel">
              <span data-localise="hints/extapimap/mapEngine"></span>
            </p>
            <form class="vzb-dialog-paragraph vzb-map-engine"></form>
          </div>
          <div class="vzb-lmap-container vzb-lmap-style">
            <p class="vzb-dialog-sublabel">
              <span data-localise="hints/extapimap/mapStyle"></span>
            </p>
            <form class="vzb-dialog-paragraph  vzb-map-style"></form>
          </div>
        </div>
        <div class="vzb-dialog-buttons">
          <div data-click="closeDialog" class="vzb-dialog-button vzb-label-primary">
            <span data-localise="buttons/ok"></span>
          </div>
        </div>
      </div>
    `;
  
    config.subcomponents = [
    ];  

    super(config);  
  }

  setup(options) {
    super.setup(options);
    const _this = this;

    this.DOM.mapLayers = this.element.select(".vzb-map-layers");
    this.DOM.mapEngineForm = this.element.select(".vzb-dialog-paragraph.vzb-map-engine");
    this.DOM.mapStyleForm = this.element.select(".vzb-dialog-paragraph.vzb-map-style");


    const mapEngineForm = this.DOM.mapEngineForm.selectAll("label")
      .data(mapEngines);

    mapEngineForm.exit().remove();

    mapEngineForm.enter().append("label")
      .attr("for", (d, i) => "a" + i)
      .each(function(d, i) {
        d3.select(this)
          .append("input")
          .attr("id", "a" + i)
          .attr("type", "radio")
          .attr("name", "engine")
          .attr("value", d.value)
          .on("change", () => _this.setModel("mapEngine", d.value));
        d3.select(this)
          .append("span")
          .text(d.title);
      });

    this.DOM.mapLayers.select("input[name='showBubbles']")
      .property("checked", d => _this.root.ui.chart.map.showBubbles)
      .on("change", function() {
        _this.setModel("showBubbles", d3.select(this).property("checked"));
      });
    this.DOM.mapLayers.select("input[name='showAreas']")
      .property("checked",  _this.root.ui.chart.map.showAreas)
      .on("change", function() {
        _this.setModel("showAreas", d3.select(this).property("checked"));
      });
    this.DOM.mapLayers.select("input[name='showMap']")
      .property("checked",  _this.root.ui.chart.map.showMap)
      .on("change", function() {
        _this.setModel("showMap", d3.select(this).property("checked"));
      });

  }

  draw(){
    super.draw();
  

    this.addReaction(this.updateView);
  }

  updateView() {
    const _this = this;
    this.DOM.mapStyleForm.selectAll("label").remove();
    const mapStyleForm = this.DOM.mapStyleForm.selectAll("label")
      .data(mapStyles[this.root.ui.chart.map.mapEngine] || []);

    mapStyleForm.exit().remove();

    mapStyleForm.enter().append("label")
      .attr("for", (d, i) => "a" + i)
      .each(function(d, i) {
        d3.select(this)
          .append("input")
          .attr("id", "a" + i)
          .attr("type", "radio")
          .attr("name", "layer")
          .attr("value", d.value)
          .on("change", () => _this.setModel("mapStyle", d.value));
        d3.select(this)
          .append("span")
          .text(d.title);
      });

    this.DOM.mapEngineForm.selectAll("input")
      .property("checked", d => d.value === this.root.ui.chart.map.mapEngine);

    this.DOM.mapStyleForm.selectAll("input")
      .property("checked", d => d.value === this.root.ui.chart.map.mapStyle);

    this.DOM.mapLayers.select("input[name='showBubbles']")
      .property("checked", this.root.ui.chart.map.showBubbles);
    this.DOM.mapLayers.select("input[name='showAreas']")
      .property("checked", this.root.ui.chart.map.showAreas);
    this.DOM.mapLayers.select("input[name='showMap']")
      .property("checked", this.root.ui.chart.map.showMap);
  }

  setModel(what, value) {
    runInAction(() => {

      if (what === "mapEngine") {
        this.root.ui.chart.map.mapEngine = value;
        this.root.ui.chart.map.mapStyle = mapStyles[value][0].value;
      }
      if (what === "mapStyle") {
        this.root.ui.chart.map.mapStyle = value;
      }
      if (what === "showBubbles" || what === "showAreas" || what === "showMap") {
        this.root.ui.chart.map[what] = value;
      }
    });
  }

}

Dialog.add("mapoptions", MapOptions);
