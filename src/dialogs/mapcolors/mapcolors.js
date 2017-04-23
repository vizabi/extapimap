/*!
 * VIZABI COLOR DIALOG
 */

const Mapcolors = Vizabi.Component.get("_dialog").extend("mapcolors", {

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
      model: ["state.time", "state.entities", "state.marker", "state.marker.color_map", "locale"]
    }];


    this._super(config, parent);
    this.template = require("./mapcolors.html");
  }

});

export default Mapcolors;
