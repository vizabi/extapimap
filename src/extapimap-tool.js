import "./styles.scss";
import { 
  BaseComponent,
  TimeSlider,
  DataNotes,
  LocaleService,
  LayoutService,
  CapitalVizabiService,
  TreeMenu,
  SteppedSlider,
  Dialogs,
  ButtonList,
  versionInfo
} from "@vizabi/shared-components";
import { VizabiExtApiMap } from "./extapimap-cmp.js";

import "./dialogs/mapoptions/mapoptions";
import "./dialogs/mapcolors/mapcolors";

export default class ExtApiMap extends BaseComponent {

  constructor(config){
    const fullMarker = config.model.markers.bubble;
    config.Vizabi.utils.applyDefaults(fullMarker.config, ExtApiMap.DEFAULT_CORE());  

    const frameType = config.Vizabi.stores.encodings.modelTypes.frame;
    const { marker, splashMarker } = frameType.splashMarker(fullMarker);

    config.name = "extapimap";

    config.subcomponents = [{
      type: VizabiExtApiMap,
      placeholder: ".vzb-extapimap",
      model: marker,
      name: "chart"
    },{
      type: TimeSlider,
      placeholder: ".vzb-timeslider",
      name: "time-slider",
      model: marker
    },{
      type: SteppedSlider,
      placeholder: ".vzb-speedslider",
      name: "speed-slider",
      model: marker
    },{
      type: TreeMenu,
      placeholder: ".vzb-treemenu",
      name: "tree-menu",
      model: marker
    },{
      type: DataNotes,
      placeholder: ".vzb-datanotes",
      model: marker
    },{
      type: Dialogs,
      placeholder: ".vzb-dialogs",
      model: marker,
      name: "dialogs"
    },{
      type: ButtonList,
      placeholder: ".vzb-buttonlist",
      name: "buttons",
      model: marker
    }];

    config.template = `
      <div class="vzb-extapimap"></div>
      <div class="vzb-animationcontrols">
        <div class="vzb-timeslider"></div>
        <div class="vzb-speedslider"></div>
      </div>
      <div class="vzb-sidebar">
        <div class="vzb-dialogs"></div>
        <div class="vzb-buttonlist"></div>
      </div>
      <div class="vzb-treemenu"></div>
      <div class="vzb-datanotes"></div>
    `;
  
    config.locale.Vizabi = config.Vizabi;
    config.layout.Vizabi = config.Vizabi;
    config.services = {
      Vizabi: new CapitalVizabiService({Vizabi: config.Vizabi}),
      locale: new LocaleService(config.locale),
      layout: new LayoutService(config.layout)
    };

    super(config);
    this.splashMarker = splashMarker;
  }
}

ExtApiMap.mainComponent = VizabiExtApiMap;

ExtApiMap.DEFAULT_UI = {
  chart: {
    viewWH: {
      width: 0,
      height: 0
      
    },
    map: {
      "showBubbles": true,
      "showAreas": false,
      "showMap": true,
      "mapEngine": "mapbox",
      "mapStyle": "mapbox://styles/mapbox/light-v9",    
      overflowBottom: 50
    },
    opacitySelectDim: 0.3,
    opacityRegular: 0.5,
    cursorMode: "arrow",
    panWithArrow: true,
    adaptMinMaxZoom: false,
    zoomOnScrolling: true,
  }
};

ExtApiMap.DEFAULT_CORE = () => ({
  encoding: {
    "size": {
      scale: {
        modelType: "size",
        allowedTypes: ["linear", "log", "genericLog", "pow"],
      }
    },
    "size_label": {
      data: {
        constant: "_default"
      },
      scale: {
        modelType: "size",
        extent: [0, 0.34]
      }
    }
  }
});

ExtApiMap.versionInfo = { version: __VERSION, build: __BUILD, package: __PACKAGE_JSON_FIELDS, sharedComponents: versionInfo};
