import "./styles.scss";
import { 
  BaseComponent,
  TimeSlider,
  DataNotes,
  DataWarning,
  LocaleService,
  LayoutService,
  CapitalVizabiService,
  MarkerContextmenu,
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
    const fullMarker = config.model.markers?.bubble;
    const fullMarkerLegend = config.model.markers?.legend;
    const fullMarkerLegendMap = config.model.markers?.legend_map;
    config.Vizabi.utils.applyDefaults(fullMarker?.config || {}, ExtApiMap.DEFAULT_MODEL.bubble);  
    config.Vizabi.utils.applyDefaults(fullMarkerLegend?.config || {}, ExtApiMap.DEFAULT_MODEL.legend);  
    config.Vizabi.utils.applyDefaults(fullMarkerLegendMap?.config || {}, ExtApiMap.DEFAULT_MODEL.legend_map);  

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
      type: MarkerContextmenu,
      placeholder: ".vzb-marker-contextmenu",
      model: marker,
      name: "marker-contextmenu"
    },{
      type: DataWarning,
      placeholder: ".vzb-datawarning",
      options: {appendButtonHere: ".vzb-extapimap"},
      model: marker,
      name: "data-warning"
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
      <div class="vzb-marker-contextmenu"></div>
      <div class="vzb-datawarning"></div>
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
  "locale": { "shortNumberFormat": true },
  "layout": { "projector": false },

  "buttons": {
    "buttons": ["markercontrols", "moreoptions", "presentation", "sidebarcollapse", "fullscreen"]
  },
  "dialogs": {
    "dialogs": {
      "popup": ["markercontrols", "moreoptions"],
      "sidebar": ["markercontrols", "zoom"],
      "moreoptions": [
        "opacity",
        "speed",
        "size",
        "colors",
        "label",
        "mapcolors",
        "mapoptions",
        "zoom",
        "technical",
        "presentation",
        "about"
      ]
    },
    "markercontrols": {
      "disableSlice": true,
      "disableAddRemoveGroups": true,
      "primaryDim": null,
      "drilldown": null,
      "shortcutForSwitch": false,
      "shortcutForSwitch_allow": null
    } 
  },
  "marker-contextmenu": {
    "primaryDim": null,
    "drilldown": null,
  },
  "tree-menu": {
    "showDataSources": false,
    "folderStrategyByDataset": {}
  },
  "chart": {
    "map": {
      "skipShapesLoading": false,
      "missingDataColor": false, //"#999" or false for transparent
      "preserveAspectRatio": true,
      "mapEngine": "mapbox",
      "mapStyle": "mapbox://styles/mapbox/light-v9",
      "showBubbles": false,
      "showAreas": true,
      "showMap": true,
      "path": null,
      "projection": "mercator",
      "topology": {
        "path": "assets/shapes.json",
        "objects": {
          "areas": "shapes",
          "boundaries": "shapes",
        },
        "geoIdProperty": "id",
      }
    },
    "opacitySelectDim": 0.3,
    "opacityHighlightDim": 0.3,
    "opacityRegular": 0.8,
    "cursorMode": "arrow",
    "panWithArrow": true,
    "adaptMinMaxZoom": false,
    "zoomOnScrolling": true,
    "labels": {
      "enabled": true,
      "dragging": true,
      "removeLabelBox": true
    },
  },
  "data-warning": {
    "enable": false,
    "margin": {
      "LARGE": { "bottom": 20 },
      "MEDIUM": { "bottom": 20 },
      "SMALL": { "bottom": 10 }
    }
  }
};

ExtApiMap.DEFAULT_MODEL = {
  "bubble": {
    "requiredEncodings": ["color_map"],

    "encoding": {
      "show": {
        "modelType": "selection"
      },
      "selected": {
        "modelType": "selection"
      },
      "highlighted": {
        "modelType": "selection"
      },
      "superhighlighted": {
        "modelType": "selection"
      },
      "order": {
        "modelType": "order",
        "direction": "desc",
        "data": {
          "ref": "markers.bubble.config.encoding.size.data"
        }
      },
      "color": {
        "data": {
          "constant": "_default"
        },
        "scale": {
          "modelType": "color",
          "type": "ordinal"
        }
      },
      "color_map": {
        "data": { },
        "scale": {
          "modelType": "color"
        }
      },
      "size": {
        "data": {
          "constant": "_default"
        },
        "scale": {
          "modelType": "size",
          "allowedTypes": ["linear", "point"],
          "extent": [0, 1]
        }
      },
      "label": {
        "data": {
          "modelType": "entityPropertyDataConfig"
        }
      },
      "size_label": {
        "data": {
          "constant": "_default"
        },
        "scale": {
          "modelType": "size",
          "allowedTypes": ["linear", "log", "genericLog", "pow", "point", "ordinal"],
          "extent": [0, 0.34]
        }
      },
      "frame": {
        "modelType": "frame",
        "speed": 200,
        "splash": true
      },
      "centroid": {
        "data": { }
      },
      // "lat": {
      //   data: {
      //     space: ["geo"],
      //     concept: "latitude"
      //   }
      // },
      // "lon": {
      //   data: {
      //     space: ["geo"],
      //     concept: "longitude"
      //   }
      // }
    }
  },
  "legend": {
    "data": {
      "ref": {
        "transform": "entityConceptSkipFilter",
        "path": "markers.bubble.encoding.color"
      }
    },
    "encoding": {
      "color": {
        "data": {
          "concept": { "ref": "markers.bubble.encoding.color.data.concept" },
          "constant": { "ref": "markers.bubble.encoding.color.data.constant" }
        },
        "scale": {
          "modelType": "color",
          "palette": { "ref": "markers.bubble.encoding.color.scale.palette" },
          "domain": null,
          "range": null,
          "type": null,
          "zoomed": null,
          "zeroBaseline": false,
          "clamp": false,
          "allowedTypes": null
        }
        //"scale": { "ref": "markers.bubble.encoding.color.scale" }
      },
      "name": { "data": {  } },
      "order": {
        "modelType": "order",
        "direction": "asc",
        "data": { }
      },
      "map": { "data": { } }
    }
  },
  "legend_map": {
    "data": {
      "ref": {
        "transform": "entityConceptSkipFilter",
        "path": "markers.bubble.encoding.color_map"
      }
    },
    "encoding": {
      "color": {
        "data": {
          "concept": { "ref": "markers.bubble.encoding.color_map.data.concept" },
          "constant": { "ref": "markers.bubble.encoding.color_map.data.constant" }
        },
        "scale": {
          "modelType": "color",
          "palette": { "ref": "markers.bubble.encoding.color_map.scale.palette" }
        }
        //"scale": { "ref": "markers.bubble.encoding.color.scale" }
      },
      "name": { "data": { } },
      "order": {
        "modelType": "order",
        "direction": "asc",
        "data": { }
      },
      "map": { "data": { } }
    }
  }
};

ExtApiMap.versionInfo = { version: __VERSION, build: __BUILD, package: __PACKAGE_JSON_FIELDS, sharedComponents: versionInfo};
