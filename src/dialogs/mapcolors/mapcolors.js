import {Dialog, IndicatorPicker, ColorLegend} from "@vizabi/shared-components";

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

