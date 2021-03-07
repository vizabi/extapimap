import {Dialog, IndicatorPicker, ColorLegend} from "VizabiSharedComponents";

/*!
 * VIZABI COLOR DIALOG
 */

export class Mapcolors extends Dialog {

  constructor(config){
    config.template = `
      <div class='vzb-dialog-modal'>
        <span class="thumb-tack-class thumb-tack-class-ico-pin fa" data-dialogtype="mapcolors" data-click="pinDialog"></span>
        <span class="thumb-tack-class thumb-tack-class-ico-drag fa" data-dialogtype="mapcolors" data-click="dragDialog"></span>

        <div class="vzb-dialog-title">
          <span data-localise="buttons/mapcolors"></span>
          <span class="vzb-caxis-selector"></span>
        </div>

        <div class="vzb-dialog-content vzb-dialog-scrollable">
          <div class="vzb-clegend-container"></div>
        </div>

        <div class="vzb-dialog-buttons">
          <div data-click="closeDialog" class="vzb-dialog-button vzb-label-primary">
            <span data-localise="buttons/ok"></span>
          </div>
        </div>

      </div>
    `;

    config.subcomponents = [{
      type: IndicatorPicker,
      placeholder: ".vzb-caxis-selector",
      options: {
        submodel: "encoding",
        targetProp: "color_map",
        showHoverValues: true
      }
    }, {
      type: ColorLegend,
      placeholder: ".vzb-clegend-container",
      options: {
        colorModelName: "color_map",
        legendModelName: "legend_map"
      }
    }];
    
    super(config);
  }

}

Dialog.add("mapcolors", Mapcolors);


const _Mapcolors = {

  /**
   * Initializes the dialog component
   * @param config component configuration
   * @param parent component context (parent)
   */
  init(config, parent) {
    this.name = "mapcolors";

    this.components = [{
      component: Vizabi.Component.get("indicatorpicker"),
      placeholder: ".vzb-caxis-selector",
      model: ["state.time", "state.marker.color_map", "locale"],
      showHoverValues: true
    }, {
      component: Vizabi.Component.get("colorlegend"),
      placeholder: ".vzb-clegend-container",
      model: ["state.time", "state.entities", "state.marker", "state.marker.color_map", "locale", "ui"]
    }];


    this._super(config, parent);
    this.template = require("./mapcolors.html");
  }

};
