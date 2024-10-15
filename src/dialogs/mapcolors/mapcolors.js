import "./_mapcolors.scss";
import {Dialog, IndicatorPicker, ColorLegend, SimpleCheckbox} from "@vizabi/shared-components";

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
          <div class="vzb-options-container"></div>
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
    }, {
      type: SimpleCheckbox,
      placeholder: ".vzb-options-container",
      options: {
        checkbox: "useBivariateColorScaleWithDataFromXY",
        submodel: "root.ui.chart.map"
      }
    }];
    
    super(config);
  }

  setup(options) {
    super.setup(options);
  }

  draw(){
    super.draw();
    this.addReaction(this.updateView);
  }

  updateView() {
    this.element.classed("vzb-bivariate", !!this.root.ui.chart.map.useBivariateColorScaleWithDataFromXY);
    this.findChild({type: "ColorLegend"})._updateView();
  }
}

Dialog.add("mapcolors", Mapcolors);

