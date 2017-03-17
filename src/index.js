import "./styles.scss";
import component from "./component";


const LBubbleMap = Vizabi.Tool.extend("LBubbleMap", {

  /**
   * Initializes the tool (Bar Chart Tool).
   * Executed once before any template is rendered.
   * @param {Object} placeholder Placeholder element for the tool
   * @param {Object} external_model Model as given by the external page
   */
  init(placeholder, external_model) {

    this.name = "bubblemap";

    //specifying components
    this.components = [{
      component,
      placeholder: ".vzb-tool-viz",
      model: ["state.time", "state.entities", "state.marker", "locale", "ui"] //pass models to component
    }, {
      component: Vizabi.Component.get("timeslider"),
      placeholder: ".vzb-tool-timeslider",
      model: ["state.time", "state.entities", "state.marker", "ui"]
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
      model: ["state.marker", "state.marker_tags", "state.time", "locale"]
    }, {
      component: Vizabi.Component.get("datawarning"),
      placeholder: ".vzb-tool-datawarning",
      model: ["locale"]
    }, {
      component: Vizabi.Component.get("datanotes"),
      placeholder: ".vzb-tool-datanotes",
      model: ["state.marker", "locale"]
    }];
    //constructor is the same as any tool
    this._super(placeholder, external_model);
  },

  default_model: {
    state: {
      time: {
        "delay": 100,
        "delayThresholdX2": 50,
        "delayThresholdX4": 25
      },
      entities: {
        "opacitySelectDim": 0.3,
        "opacityRegular": 1
      }
    },
    locale: {},
    ui: {
      map: {
        path: null,
        preserveAspectRatio: true,
        bounds: {
          north: 60.25,
          west: 17.4,
          south: 58.7,
          east: 19.6
        },
        offset: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        },
        projection: "mercator",
        topology: {
          path: "data/sodertorn-basomr2010.json",
          objects: {
            geo: "c1e171fae817c0bfc26dc7df82219e08",
            boundaries: "c1e171fae817c0bfc26dc7df82219e08"
          },
          geoIdProperty: "BASKOD2010"
        }
      },
      cursorMode: "arrow",
      panWithArrow: false,
      adaptMinMaxZoom: false,
      zoomOnScrolling: false,
      "buttons": ["colors", "size", "find", "moreoptions", "mapcolors", "fullscreen", "presentation"],
      "dialogs": {
        "popup": ["colors", "mapcolors", "find", "size", "moreoptions"],
        "sidebar": ["colors", "find", "mapoptions", "zoom"],
        "moreoptions": ["mapoptions", "opacity", "speed", "size", "colors", "mapcolors", "presentation", "about"]
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
});

export default LBubbleMap;
