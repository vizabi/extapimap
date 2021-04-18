import "./styles.scss";
import { 
  BaseComponent,
  TimeSlider,
  DataNotes,
  LocaleService,
  LayoutService,
  TreeMenu,
  SteppedSlider,
  Dialogs,
  ButtonList
} from "VizabiSharedComponents";
import { VizabiExtApiMap } from "./component.js";

import "./dialogs/mapoptions/mapoptions";
import "./dialogs/mapcolors/mapcolors";

export default class ExtApiMap extends BaseComponent {

  constructor(config){
    const marker = config.model.markers.bubble.encoding.frame.splash.marker;

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
  
    config.services = {
      locale: new LocaleService(config.locale),
      layout: new LayoutService(config.layout)
    };

    super(config);
  }
};

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

ExtApiMap.versionInfo = { version: __VERSION, build: __BUILD };

const _ExtApiMap = {

  /**
   * Initializes the tool (Bar Chart Tool).
   * Executed once before any template is rendered.
   * @param {Object} placeholder Placeholder element for the tool
   * @param {Object} external_model Model as given by the external page
   */
  init(placeholder, external_model) {

    this.name = "extapimap";

    //specifying components
    this.components = [{
      component,
      placeholder: ".vzb-tool-viz",
      model: ["state.time", "state.marker", "locale", "ui", "data"] //pass models to component
    }, {
      component: Vizabi.Component.get("timeslider"),
      placeholder: ".vzb-tool-timeslider",
      model: ["state.time", "state.marker", "ui"]
    }, {
      component: Vizabi.Component.get("dialogs"),
      placeholder: ".vzb-tool-dialogs",
      model: ["state", "ui", "locale"]
    }, {
      component: Vizabi.Component.get("buttonlist"),
      placeholder: ".vzb-tool-buttonlist",
      model: ["state", "ui", "locale"]
    }, {
      component: Vizabi.Component.get("treemenu"),
      placeholder: ".vzb-tool-treemenu",
      model: ["state.marker", "state.time", "locale", "ui"]
    }, {
      component: Vizabi.Component.get("datawarning"),
      placeholder: ".vzb-tool-datawarning",
      model: ["locale"]
    }, {
      component: Vizabi.Component.get("datanotes"),
      placeholder: ".vzb-tool-datanotes",
      model: ["state.marker", "locale"]
    }, {
      component: Vizabi.Component.get("steppedspeedslider"),
      placeholder: ".vzb-tool-stepped-speed-slider",
      model: ["state.time", "locale"]
    }];
    //constructor is the same as any tool
    this._super(placeholder, external_model);
  },

  default_model: {
    state: {
      time: {
        "autoconfig": {
          "type": "time"
        }
      },
      entities: {
        "autoconfig": {
          "type": "entity_domain",
          "excludeIDs": ["tag"]
        }
      },
      entities_colorlegend: {
        "autoconfig": {
          "type": "entity_domain",
          "excludeIDs": ["tag"]
        }
      },
      "entities_map_colorlegend": {
        "autoconfig": {
          "type": "entity_domain",
          "excludeIDs": ["tag"]
        }
      },
      marker: {
        limit: 1000,
        space: ["entities", "time"],
        label: {
          use: "property",
          "autoconfig": {
            "includeOnlyIDs": ["name"],
            "type": "string"
          }
        },
        size: {
          "autoconfig": {
              index: 0,
              type: "measure"
            }
        },
        color: {
          syncModels: ["marker_colorlegend"],
          "autoconfig": {
            index: 1,
            type: "measure"
          }
        },
        color_map: {
          syncModels: ["marker_colorlegend"],
          "autoconfig": {}
        }
      },
      "marker_colorlegend": {
        "space": ["entities_colorlegend"],
        "label": {
          "use": "property",
          "which": "name"
        },
        "hook_rank": {
          "use": "property",
          "which": "rank"
        },
        "hook_geoshape": {
          "use": "property",
          "which": "shape_lores_svg"
        }
      }
    },
    locale: {},
    ui: {
      map: {
        overflowBottom: 50
      },
      cursorMode: "arrow",
      panWithArrow: true,
      adaptMinMaxZoom: false,
      zoomOnScrolling: true,
      "buttons": ["colors", "size", "find", "moreoptions", "mapcolors", "zoom", "presentation", "sidebarcollapse", "fullscreen"],
      "dialogs": {
        "popup": ["colors", "mapcolors", "find", "size", "zoom", "moreoptions"],
        "sidebar": ["colors", "find", "mapoptions", "zoom"],
        "moreoptions": ["mapoptions", "opacity", "speed", "size", "colors", "mapcolors", "zoom", "presentation", "technical", "about"]
      },
      chart: {
        labels: {
          dragging: true
        }
      },
      datawarning: {
        doubtDomain: [],
        doubtRange: []
      },
      presentation: false
    }
  }
};
