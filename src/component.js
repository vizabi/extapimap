const {
  utils,
  helpers: {
    labels: Labels,
    "d3.dynamicBackground": DynamicBackground,
  },
  iconset: {
    warn: iconWarn,
    question: iconQuestion
  },
} = Vizabi;

import MapEngine from "./map";
// import Selectlist from 'extapimap-selectlist';

//BUBBLE MAP CHART COMPONENT
const ExtApiMapComponent = Vizabi.Component.extend("extapimap", {
  /**
   * Initializes the component (Bubble Map Chart).
   * Executed once before any template is rendered.
   * @param {Object} config The config passed to the component
   * @param {Object} context The component's parent
   */
  init(config, context) {
    this.name = "extapimap";
    this.template = require("./template.html");
    this.bubblesDrawing = null;


    this.isMobile = utils.isMobileOrTablet();

    //define expected models for this component
    this.model_expects = [
      {
        name: "time",
        type: "time"
      },
      {
        name: "marker",
        type: "marker"
      },
      {
        name: "locale",
        type: "locale"
      },
      {
        name: "ui",
        type: "ui"
      },
      {
        name: "data",
        type: "data"
      }
    ];

    const _this = this;
    this.model_binds = {
      "change:time.value": function(evt) {
        if (!_this._readyOnce) return;
        _this.model.marker.getFrame(_this.model.time.value, _this.frameChanged.bind(_this));
      },
      "change:marker.highlight": function(evt) {
        if (!_this._readyOnce) return;
        _this.highlightMarkers();
        _this.updateOpacity();
      },
      "change:marker": function(evt, path) {
        // bubble size change is processed separately
        if (!_this._readyOnce) return;

        if (path.indexOf("scaleType") > -1) {
          _this.ready();
        }
      },
      "change:marker.size.extent": function(evt, path) {
        //console.log("EVENT change:marker:size:max");
        if (!_this._readyOnce || !_this.entityBubbles) return;
        _this.updateMarkerSizeLimits();
        _this.redrawDataPoints(null, false);
      },
      "change:marker.color.palette": function(evt, path) {
        if (!_this._readyOnce) return;
        _this.redrawDataPoints(null, false);
      },
      "change:marker.select": function(evt, path) {
        if (!_this._readyOnce) return;
        if (path.indexOf("select.labelOffset") !== -1) return;

        _this.selectMarkers();
        _this.redrawDataPoints(null, false);
        _this.updateLabels(null);
        _this.updateOpacity();
        _this.updateDoubtOpacity();

      },
      "change:marker.opacitySelectDim": function(evt) {
        _this.updateOpacity();
      },
      "change:marker.opacityRegular": function(evt) {
        _this.updateOpacity();
      },
      "change:ui.map.mapStyle": function(evt) {
        _this.map.layerChanged();
      },
      "change:ui.map.showBubbles": function(evt) {
        _this.updateEntities();
        _this.redrawDataPoints(null, true);
        _this._reorderEntities();
        _this.updateOpacity();
      },
      "change:ui.map.showAreas": function(evt) {
        _this.map.layerChanged();
      },
      "change:ui.map.showMap": function(evt) {
        _this.map.layerChanged();
      },
      "change:ui.cursorMode": function() {
        const svg = _this.mainCanvas;
        if (_this.model.ui.cursorMode === "plus") {
          svg.classed("vzb-zoomin", true);
          svg.classed("vzb-zoomout", false);
          svg.classed("vzb-panhand", false);
        } else if (_this.model.ui.cursorMode === "minus") {
          svg.classed("vzb-zoomin", false);
          svg.classed("vzb-zoomout", true);
          svg.classed("vzb-panhand", false);
        } else if (_this.model.ui.cursorMode === "hand") {
          svg.classed("vzb-zoomin", false);
          svg.classed("vzb-zoomout", false);
          svg.classed("vzb-panhand", true);
        } else {
          svg.classed("vzb-zoomin", false);
          svg.classed("vzb-zoomout", false);
          svg.classed("vzb-panhand", false);
        }
      }
    };

    //this._selectlist = new Selectlist(this);

    //contructor is the same as any component
    this._super(config, context);

    this.sScale = null;
    this.cScale = d3.scaleOrdinal(d3.schemeCategory10);

    _this.COLOR_WHITEISH = "#fdfdfd";
    _this.COLOR_WHITEISH = "#fdfdfd";

    this._labels = new Labels(this);

    this._labels.config({
      CSS_PREFIX: "vzb-bmc",
      LABELS_CONTAINER_CLASS: "vzb-bmc-labels",
      LINES_CONTAINER_CLASS: "vzb-bmc-lines",
      SUPPRESS_HIGHLIGHT_DURING_PLAY: false
    });

    d3.namespaces.custom = "https://d3js.org/namespace/custom";

    _this.globalAttr = {
      strokeColor: [51/255, 51/255, 51/255],
      strokeWidth: 1.0,
      strokeOpacity: 0.7
    }
  },


  /**
   * DOM is ready
   */
  readyOnce() {
    this.element = d3.select(this.element);

    // reference elements
    this.chartSvg = this.element.select("svg.vzb-extapimap-svg-front");
    this.chartSvgBack = this.element.select("svg.vzb-extapimap-svg-back");
    this.chartSvgAll = this.element.selectAll("svg.vzb-extapimap-svg");
    this.graph = this.chartSvg.select(".vzb-bmc-graph");
    this.graphBack = this.chartSvgBack.select(".vzb-bmc-graph");
    this.graphAll = this.chartSvgAll.select(".vzb-bmc-graph");

    //this.bubbleContainerCrop = this.graph.select(".vzb-bmc-bubbles-crop");
    //this.bubbleContainer = this.graph.select(".vzb-bmc-bubbles");
    this.labelListContainer = this.graph.select(".vzb-bmc-bubble-labels");
    this.dataWarningEl = this.graphBack.select(".vzb-data-warning");
    this.zoomRect = this.element.select(".vzb-bc-zoom-rect");
    this.yTitleEl = this.graphBack.select(".vzb-bmc-axis-y-title");
    this.cTitleEl = this.graphBack.select(".vzb-bmc-axis-c-title");
    this.yInfoEl = this.graphBack.select(".vzb-bmc-axis-y-info");
    this.cInfoEl = this.graphBack.select(".vzb-bmc-axis-c-info");

    this.entityBubbles = null;

    // year background
    this.yearEl = this.graphBack.select(".vzb-bmc-year");
    this.year = new DynamicBackground(this.yearEl);
    this.year.setConditions({ xAlign: "left", yAlign: "bottom" });

    this.bubbleContainer = d3.create("custom:bubbles");
    this.canvases = this.element.select(".vzb-extapimap-canvases");
    this.mainCanvas = this.canvases.select(".vzb-bmc-main-canvas");
    this.hiddenCanvas = this.canvases.select(".vzb-bmc-hidden-canvas");
    this._nextCol = 1;
    this._colorToNode = {};

    //this.offscreenCanvas = d3.create("canvas");
    
    this.mainCanvas.on('mousemove', function() {
      if (utils.isTouchDevice() || (_this.model.ui.cursorMode !== "arrow" && _this.model.ui.cursorMode !== "hand")) return;

      const node = _this.trackCanvasObject(d3.event.offsetX * _this.devicePixelRatio, d3.event.offsetY * _this.devicePixelRatio);
      if (node) {
        const d = d3.select(node).datum();
        _this.mainCanvas.style("cursor", "pointer");
        if (_this.someHighlighted) {
          //break if same bubble hovered
          if (_this.model.marker.isHighlighted(d)) return;
          _this._interact()._mouseout(_this.model.marker.highlight[0]);
        }

        _this._interact()._mouseover(d);
      } else if (_this.someHighlighted) {
        _this.mainCanvas.style("cursor", null);
        _this._interact()._mouseout(_this.model.marker.highlight[0]);
      }
    });
    
    this.mainCanvas.on('mouseout', function() {
      if (_this.someHighlighted) {
        _this.mainCanvas.style("cursor", null);
        _this._interact()._mouseout(_this.model.marker.highlight[0]);
      }
    });
    
    this.mainCanvas.on('click', function() {
      if (utils.isTouchDevice() || (_this.model.ui.cursorMode !== "arrow" && _this.model.ui.cursorMode !== "hand")) return;

      const node = _this.trackCanvasObject(d3.event.offsetX * _this.devicePixelRatio, d3.event.offsetY * _this.devicePixelRatio);
      if(node) {
        const d = d3.select(node).datum();
        _this._interact()._click(d);
      }
    });

    //gl 
    this.gl = this.mainCanvas.node().getContext("webgl") || this.mainCanvas.node().getContext("experimental-webgl");
    this.glInit(this.gl);
    //picking gl 
    this.pickingGl = this.hiddenCanvas.node().getContext("webgl", {alpha:false}) || this.hiddenCanvas.node().getContext("experimental-webgl", {alpha:false});
    this.pickingGlInit(this.pickingGl);

    const _this = this;
    this.on("resize", () => {
      //return if updatesize exists with error
      if (_this.updateSize()) return;
      _this.map.rescaleMap();
    });

    this.TIMEDIM = this.model.time.getDimension();
    this.KEYS = utils.unique(this.model.marker._getAllDimensions({ exceptType: "time" }));
    this.KEY = this.KEYS.join(",");
    this.dataKeys = this.model.marker.getDataKeysPerHook();

    this.updateUIStrings();

    this.wScale = d3.scaleLinear()
      .domain(this.model.ui.datawarning.doubtDomain)
      .range(this.model.ui.datawarning.doubtRange);

    this._labels.readyOnce();

    const mapDragger = d3.drag()
      .on("start", (d, i) => {
        if (
          ((d3.event.sourceEvent.metaKey || d3.event.sourceEvent.ctrlKey) && _this.model.ui.cursorMode == "arrow") ||
          _this.model.ui.cursorMode == "plus"

        ) {
          _this.dragAction = "zooming";
          _this.zooming = true;
          const mouse = d3.mouse(this.graph.node().parentNode);
          _this.origin = {
            x: mouse[0],
            y: mouse[1]
          };
          _this.zoomRect.classed("vzb-invisible", false);
        } else if (
          _this.model.ui.cursorMode == "hand" ||
          (_this.ui.panWithArrow && _this.ui.cursorMode === "arrow")
        ) {
          _this.dragAction = "prepanning";
          // _this._hideEntities();
          // _this.map.panStarted();
          // _this.chartSvg.classed("vzb-zooming", true);
        }
      })
      .on("drag", (d, i) => {
        switch (_this.dragAction) {
          case "zooming":
            const mouse = d3.mouse(this.graph.node().parentNode);
            _this.zoomRect
              .attr("x", Math.min(mouse[0], _this.origin.x))
              .attr("y", Math.min(mouse[1], _this.origin.y))
              .attr("width", Math.abs(mouse[0] - _this.origin.x))
              .attr("height", Math.abs(mouse[1] - _this.origin.y));
            break;
          case "panning":
            _this.map.moveOver(d3.event.dx, d3.event.dy);
            break;
          case "prepanning":
            if (d3.event.dx !== 0 || d3.event.dy !== 0) {
              _this.dragAction = "panning";
              _this._hideEntities();
              _this.map.panStarted();
              _this.chartSvg.classed("vzb-zooming", true);
            }
            break;
        }
      })
      .on("end", (d, i) => {
        switch (_this.dragAction) {
          case "zooming":
            _this.zoomRect
              .attr("width", 0)
              .attr("height", 0)
              .classed("vzb-invisible", true);
            if (_this.zooming) {
              const mouse = d3.mouse(this.graph.node().parentNode);
              if (Math.abs(_this.origin.x - mouse[0]) < 5 || Math.abs(_this.origin.y - mouse[1]) < 5) {
                _this._hideEntities();
                _this.map.zoomMap(mouse, 1).then(
                  () => {
                    _this._showEntities(300);
                  }
                );
              } else {
                _this.map.zoomRectangle(_this.origin.x, _this.origin.y, mouse[0], mouse[1]);
              }
            }
            break;
          case "panning":
            _this.map.panFinished();
            _this._showEntities(300);
            _this.chartSvg.classed("vzb-zooming", false);
            break;
        }
        if (_this.model.ui.cursorMode == "minus") {
          const mouse = d3.mouse(this.graph.node());
          _this._hideEntities();
          _this.map.zoomMap(mouse, -1).then(
            () => {
              _this._showEntities(300);
            }
          );
        }
        _this.dragAction = null;
        _this.zooming = false;
      });
    const zoomOnWheel = function() {
      if (_this.model.ui.zoomOnScrolling) {
        const mouse = d3.mouse(_this.graph.node());
        _this._hideEntities();
        _this.map.zoomMap(mouse, d3.event.wheelDelta > 0 ? 1 : -1).then(
          () => {
            _this._showEntities(100);
          }
        );
        d3.event.stopPropagation();
        d3.event.preventDefault();
        d3.event.returnValue = false;
        return false;
      }
    };
    this.element.call(mapDragger);
    this.element.on("mousewheel", zoomOnWheel)
      .on("wheel", zoomOnWheel);
    d3.select("body")
      .on("keydown", () => {
        if (_this.model.ui.cursorMode !== "arrow" && _this.model.ui.cursorMode !== "hand") return;
        if (d3.event.metaKey || d3.event.ctrlKey) {
          _this.element.select("svg").classed("vzb-zoomin", true);
          //_this.model.ui.set("cursorMode", "plus", false, false);
        }
      })
      .on("keyup", () => {
        if (_this.model.ui.cursorMode !== "arrow" && _this.model.ui.cursorMode !== "hand") return;
        if (!d3.event.metaKey && !d3.event.ctrlKey) {
          _this.element.select("svg").classed("vzb-zoomin", false);
          //_this.model.ui.set("cursorMode", "arrow", false, false);
        }
      })
      //this is for the case when user would press ctrl and move away from the browser tab or window
      //keyup event would happen somewhere else and won't be captured, so zoomin class would get stuck
      .on("mouseenter", () => {
        if (_this.model.ui.cursorMode !== "arrow" && _this.model.ui.cursorMode !== "hand") return;
        if (!d3.event.metaKey && !d3.event.ctrlKey) {
          _this.model.ui.cursorMode = "arrow";
        }
      });
    this.root.on("resetZoom", () => {
      _this._hideEntities();
      _this.map.resetZoom(500).then(() => {
        _this._showEntities();
      });
    });

    /*
     this.element
     .on("click", () => {
     const cursor = _this.model.ui.cursorMode;
     if (cursor !== "arrow" && cursor !== "hand") {
     const mouse = d3.mouse(this.graph.node());
     _this._hideEntities(100);
     _this.map.zoomMap(mouse, (cursor == "plus" ? 1 : -1)).then(
     () => {
     _this._showEntities(300);
     }
     );
     }
     });
     */
  },

  _hideEntities(duration) {
    this.graph.select("." + this._labels.options.LABELS_CONTAINER_CLASS)
      .transition()
      .duration(duration)
      .style("opacity", 0);
    this.graph.select("." + this._labels.options.LINES_CONTAINER_CLASS)
      .transition()
      .duration(duration)
      .style("opacity", 0);
    this.bubbleContainer
      .transition()
      .duration(duration)
      .attr("opacity", 0);
    this.canvases
      .transition()
      .duration(duration)
      .style("opacity", 0);
  },

  _showEntities(duration) {
    this.graph.select("." + this._labels.options.LABELS_CONTAINER_CLASS)
      .transition()
      .duration(duration)
      .style("opacity", 1);
    this.graph.select("." + this._labels.options.LINES_CONTAINER_CLASS)
      .transition()
      .duration(duration)
      .style("opacity", 1);
    this.bubbleContainer
      .transition()
      .duration(duration)
      .attr("opacity", 1);
    this.canvases
      .transition()
      .duration(duration)
      .style("opacity", 1);
  },


  /*
   * Both model and DOM are ready
   */
  ready() {
    const _this = this;
    this.KEYS = utils.unique(this.model.marker._getAllDimensions({ exceptType: "time" }));
    this.KEY = this.KEYS.join(",");
    this.dataKeys = this.model.marker.getDataKeysPerHook();

    this.updateUIStrings();
    this.updateIndicators();
    this.updateSize();
    this.map.rescaleMap();
    this.updateMarkerSizeLimits();
    this.model.marker.getFrame(this.model.time.value, (values, time) => {
      // TODO: temporary fix for case when after data loading time changed on validation
      if (time.toString() != _this.model.time.value.toString()) {
        utils.defer(() => {
          _this.ready();
        });
        return;
      } // frame is outdated

      if (!values) return;
      _this.values = values;

      _this.updateEntities();
      _this.updateTime();
      _this.map.ready();
      _this.map.updateColors();
      _this._labels.ready();
      //_this.redrawDataPoints(null, true);
      _this.highlightMarkers();
      _this.selectMarkers();
//    this._selectlist.redraw();
      _this.updateDoubtOpacity();
      _this.updateOpacity();
    });

  },

  frameChanged(frame, time) {
    if (time.toString() != this.model.time.value.toString()) return; // frame is outdated
    if (!frame) return;

    this.values = frame;
    this.updateTime();
    this.updateDoubtOpacity();
    this._reorderEntities();
    this.redrawDataPoints(null, false);
    this.map.updateColors();
  },

  updateUIStrings() {
    const _this = this;

    this.translator = this.model.locale.getTFunction();
    const conceptPropsS = _this.model.marker.size.getConceptprops();
    const conceptPropsC = _this.model.marker.color.getConceptprops();

    this.strings = {
      title: {
        S: conceptPropsS.name,
        C: conceptPropsC.name
      }
    };

    this.yTitleEl.select("text")
      .text(this.translator("buttons/size") + ": " + this.strings.title.S)
      .on("click", () => {
        _this.parent
          .findChildByName("gapminder-treemenu")
          .markerID("size")
          .alignX(_this.model.locale.isRTL() ? "right" : "left")
          .alignY("top")
          .updateView()
          .toggle();
      });

    this.cTitleEl.select("text")
      .text(this.translator("buttons/color") + ": " + this.strings.title.C)
      .on("click", () => {
        _this.parent
          .findChildByName("gapminder-treemenu")
          .markerID("color")
          .alignX(_this.model.locale.isRTL() ? "right" : "left")
          .alignY("top")
          .updateView()
          .toggle();
      });

    utils.setIcon(this.dataWarningEl, iconWarn).select("svg").attr("width", "0px").attr("height", "0px");
    this.dataWarningEl.append("text")
      .attr("text-anchor", "end")
      .text(this.translator("hints/dataWarning"));

    this.dataWarningEl
      .on("click", () => {
        _this.parent.findChildByName("gapminder-datawarning").toggle();
      })
      .on("mouseover", () => {
        _this.updateDoubtOpacity(1);
      })
      .on("mouseout", () => {
        _this.updateDoubtOpacity();
      });

    this.yInfoEl
      .html(iconQuestion)
      .select("svg").attr("width", "0px").attr("height", "0px")
      .style('opacity', Number(Boolean(conceptPropsS.description || conceptPropsS.sourceLink)));

    //TODO: move away from UI strings, maybe to ready or ready once
    this.yInfoEl.on("click", () => {
      _this.parent.findChildByName("gapminder-datanotes").pin();
    });
    this.yInfoEl.on("mouseover", function() {
      const rect = this.getBBox();
      const coord = utils.makeAbsoluteContext(this, this.farthestViewportElement)(rect.x - 10, rect.y + rect.height + 10);
      const toolRect = _this.root.element.getBoundingClientRect();
      const chartRect = _this.element.node().getBoundingClientRect();
      _this.parent.findChildByName("gapminder-datanotes").setHook("size").show().setPos(coord.x + chartRect.left - toolRect.left, coord.y);
    });
    this.yInfoEl.on("mouseout", () => {
      _this.parent.findChildByName("gapminder-datanotes").hide();
    });

    this.cInfoEl
      .html(iconQuestion)
      .select("svg").attr("width", "0px").attr("height", "0px")
      .style('opacity', Number(Boolean(conceptPropsC.description || conceptPropsC.sourceLink)));

    //TODO: move away from UI strings, maybe to ready or ready once
    this.cInfoEl.on("click", () => {
      _this.parent.findChildByName("gapminder-datanotes").pin();
    });
    this.cInfoEl.on("mouseover", function() {
      const rect = this.getBBox();
      const coord = utils.makeAbsoluteContext(this, this.farthestViewportElement)(rect.x - 10, rect.y + rect.height + 10);
      const toolRect = _this.root.element.getBoundingClientRect();
      const chartRect = _this.element.node().getBoundingClientRect();
      _this.parent.findChildByName("gapminder-datanotes").setHook("color").show().setPos(coord.x + chartRect.left - toolRect.left, coord.y);
    });
    this.cInfoEl.on("mouseout", () => {
      _this.parent.findChildByName("gapminder-datanotes").hide();
    });
  },

  // show size number on title when hovered on a bubble
  updateTitleNumbers() {
    const _this = this;

    let mobile; // if is mobile device and only one bubble is selected, update the ytitle for the bubble
    if (_this.isMobile && _this.model.marker.select && _this.model.marker.select.length === 1) {
      mobile = _this.model.marker.select[0];
    }

    if (_this.hovered || mobile) {
      const conceptPropsS = _this.model.marker.size.getConceptprops();
      const conceptPropsC = _this.model.marker.color.getConceptprops();

      const hovered = _this.hovered || mobile;
      const formatterS = _this.model.marker.size.getTickFormatter();
      const formatterC = _this.model.marker.color.getTickFormatter();

      const unitS = conceptPropsS.unit || "";
      const unitC = conceptPropsC.unit || "";

      const valueS = _this.values.size[utils.getKey(hovered, _this.dataKeys.size)];
      let valueC = _this.values.color[utils.getKey(hovered, _this.dataKeys.color)];

      //resolve value for color from the color legend model
      if (_this.model.marker.color.isDiscrete() && valueC) {
        valueC = this.model.marker.color.getColorlegendMarker().label.getItems()[valueC] || "";
      }

      _this.yTitleEl.select("text")
        .text(_this.translator("buttons/size") + ": " + formatterS(valueS) + " " + unitS);

      _this.cTitleEl.select("text")
        .text(_this.translator("buttons/color") + ": " +
          (valueC || valueC === 0 ? formatterC(valueC) + " " + unitC : _this.translator("hints/nodata")));

      this.yInfoEl.classed("vzb-hidden", true);
      this.cInfoEl.classed("vzb-hidden", true);
    } else {
      this.yTitleEl.select("text")
        .text(this.translator("buttons/size") + ": " + this.strings.title.S);
      this.cTitleEl.select("text")
        .text(this.translator("buttons/color") + ": " + this.strings.title.C);

      this.yInfoEl.classed("vzb-hidden", false);
      this.cInfoEl.classed("vzb-hidden", this.cTitleEl.classed("vzb-hidden"));
    }
  },

  updateDoubtOpacity(opacity) {
    if (opacity == null) opacity = this.wScale(+this.time.getUTCFullYear().toString());
    if (this.someSelected) opacity = 1;
    this.dataWarningEl.style("opacity", opacity);
  },

  updateOpacity(duration) {
    const _this = this;
    /*
     this.entityBubbles.classed("vzb-selected", function (d) {
     return _this.model.marker.isSelected(d);
     });
     */
    this.map.updateOpacity();
    this.entityBubbles.attr("opacity", d => _this.getOpacity(d));

    this.entityBubbles.classed("vzb-selected", d => _this.model.marker.isSelected(d));

    const nonSelectedOpacityZero = _this.model.marker.opacitySelectDim < 0.01;

    // when pointer events need update...
    if (nonSelectedOpacityZero !== this.nonSelectedOpacityZero) {
      this.entityBubbles.style("pointer-events", d => (!_this.someSelected || !nonSelectedOpacityZero || _this.model.marker.isSelected(d)) ?
        "visible" : "none");
    }

    this.nonSelectedOpacityZero = _this.model.marker.opacitySelectDim < 0.01;
  
    this._canvasRedraw(duration);
  },

  getMapOpacity(key) {
    if (this.model.ui.map.showBubbles) {
      return this.model.marker.opacitySelectDim;
    }
    const d = {};
    d[this.KEY] = key;
    return this.getOpacity(d);
  },

  getOpacity(d) {
    if (this.someHighlighted) {
      //highlight or non-highlight
      if (this.model.marker.isHighlighted(d)) return this.model.marker.opacityRegular;
    }

    if (this.someSelected) {
      //selected or non-selected
      return this.model.marker.isSelected(d) ? this.model.marker.opacityRegular : this.model.marker.opacitySelectDim;
    }

    if (this.someHighlighted) return this.model.marker.opacitySelectDim;

    return this.model.marker.opacityRegular;
  },

  /**
   * Changes labels for indicators
   */
  updateIndicators() {
    this.sScale = this.model.marker.size.getScale();
    this.cScale = this.model.marker.color.getScale();
    this.mcScale = this.model.marker.color_map.getScale();
  },

  /**
   * Updates entities
   */
  updateEntities() {

    const _this = this;
    const KEYS = this.KEYS;
    const KEY = this.KEY;
    const TIMEDIM = this.TIMEDIM;

    const getKeys = function(prefix) {
      prefix = prefix || "";
      return _this.model.marker.getKeys()
        .map(d => {
          const pointer = Object.assign({}, d);
          //pointer[KEY] = d[KEY];
          pointer[TIMEDIM] = endTime;
          pointer.sortValue = _this.values.size[utils.getKey(d, _this.dataKeys.size)] || 0;
          pointer[KEY] = prefix + utils.getKey(d, KEYS);
          return pointer;
        })
        .sort((a, b) => b.sortValue - a.sortValue);
    };

    // get array of GEOs, sorted by the size hook
    // that makes larger bubbles go behind the smaller ones
    const endTime = this.model.time.end;
    this.model.marker.setVisible(getKeys.call(this));

    //unselecting bubbles with no data is used for the scenario when
    //some bubbles are selected and user would switch indicator.
    //bubbles would disappear but selection would stay
    if (!this.model.time.splash) {
      this.unselectBubblesWithNoData();
    }
    let bubbles = [];
    if (this.model.ui.map.showBubbles) {
      bubbles = this.model.marker.getVisible();
    }

    this.entityBubbles = this.bubbleContainer.selectAll(".vzb-bmc-bubble")
      .data(bubbles, d => d[KEY]);

    //exit selection
    this.entityBubbles.exit().remove();

    //enter selection -- init circles
    this.entityBubbles = this.entityBubbles.enter().append("circle")
      .attr("class", "vzb-bmc-bubble")
      // .on("mouseover", (d, i) => {
      //   if (utils.isTouchDevice() || _this.model.ui.cursorMode !== "arrow") return;
      //   _this._interact()._mouseover(d, i);
      // })
      // .on("mouseout", (d, i) => {
      //   if (utils.isTouchDevice() || _this.model.ui.cursorMode !== "arrow") return;
      //   _this._interact()._mouseout(d, i);
      // })
      // .on("click", (d, i) => {
      //   if (utils.isTouchDevice() || _this.model.ui.cursorMode !== "arrow") return;
      //   _this._interact()._click(d, i);
      //   _this.highlightMarkers();
      // })
      // .onTap((d, i) => {
      //   _this._interact()._click(d, i);
      //   d3.event.stopPropagation();
      // })
      // .onLongTap((d, i) => {
      // })
      .merge(this.entityBubbles);

    this._reorderEntities();

  },

  _reorderEntities() {
    const _this = this;
    const KEY = this.KEY;
    this.bubbleContainer.selectAll(".vzb-bmc-bubble")
      .sort((a, b) => {
        const sizeA = _this.values.size[utils.getKey(a, _this.dataKeys.size)];
        const sizeB = _this.values.size[utils.getKey(b, _this.dataKeys.size)];

        if (typeof sizeA == "undefined" && typeof sizeB != "undefined") return -1;
        if (typeof sizeA != "undefined" && typeof sizeB == "undefined") return 1;
        return d3.descending(sizeA, sizeB);
      });
  },

  unselectBubblesWithNoData(frame) {
    const _this = this;
    const KEY = this.KEY;
    if (!frame) frame = this.values;

    if (!frame || !frame.size) return;

    this.model.marker.select.forEach(d => {
      const valueS = frame.size[utils.getKey(d, _this.dataKeys.size)];
      if (!valueS && valueS !== 0)
        _this.model.marker.selectMarker(d);
    });
  },
  _getPosition(d) {
    const dataKeys = this.dataKeys;
    if (this.values.hook_lat && this.values.hook_lat[utils.getKey(d, dataKeys.hook_lat)]) {
      return this.map.geo2Point(this.values.hook_lat[utils.getKey(d, dataKeys.hook_lat)], this.values.hook_lng[utils.getKey(d, dataKeys.hook_lng)]);
    }
    if (this.values.hook_centroid && this.values.hook_centroid[utils.getKey(d, dataKeys.hook_centroid)]) {
      return this.map.centroid(this.values.hook_centroid[utils.getKey(d, dataKeys.hook_centroid)]);
    }
    utils.warn("_getPosition(): was unable to resolve bubble positions either via lat/long or centroid")
    return [0,0];
  },

  redrawDataPoints(duration, reposition) {
    const _this = this;
    if (!duration) duration = this.duration;
    if (!this.entityBubbles) return utils.warn("redrawDataPoints(): no entityBubbles defined. likely a premature call, fix it!");
    const dataKeys = this.dataKeys;
    const values = this.values;

    this.entityBubbles.each(function(d, index) {
      const view = d3.select(this);
      const valueS = values.size[utils.getKey(d, dataKeys.size)];
      const valueC = values.color[utils.getKey(d, dataKeys.color)];
      const valueL = values.label[utils.getKey(d, dataKeys.label)];
      const valueCentroid = values.hook_centroid[utils.getKey(d, dataKeys.hook_centroid)];

      d.hidden_1 = d.hidden;

      if (reposition) {
        const cLoc = _this._getPosition(d);
        if (cLoc) {
          d.cLoc = cLoc;
          view.attr("cx", d.cLoc[0])
            .attr("cy", d.cLoc[1]);
        }
      }
      d.hidden = (!valueS && valueS !== 0) || valueCentroid == null || !d.cLoc;

      if (d.hidden !== d.hidden_1) {
        if (duration) {
          view.transition().duration(duration).ease(d3.easeLinear)
            .attr("opacity", 0)
            .on("end", () => view.attr("vzb-hidden", d.hidden).attr("opacity", _this.model.marker.opacityRegular));
        } else {
          if (!d.hidden) {
            if (d.cLoc) {
              view.attr("vzb-hidden", d.hidden);
            }
          } else {
            view.attr("vzb-hidden", d.hidden);
          }
        }
      }
      if (!d.hidden) {
        d.r = utils.areaToRadius(_this.sScale(valueS || 0));
        d.label = valueL;

        view.attr("vzb-hidden", false)
          .attr("fill", valueC != null ? _this.cScale(valueC) : _this.COLOR_WHITEISH);

        if (duration) {
          view.transition().duration(duration).ease(d3.easeLinear)
            .attr("r", d.r);
        } else {
          view.interrupt()
            .attr("r", d.r)
            .transition();
        }
        _this._updateLabel(d, index, d.cLoc[0], d.cLoc[1], valueS, valueC, d.label, duration);
      } else {
        _this._updateLabel(d, index, 0, 0, valueS, valueC, valueL, duration);
      }
    });

    this._canvasRedraw(duration);
  },

  updateLabels(duration) {
    const _this = this;
    const dataKeys = this.dataKeys;
    this.model.marker.getSelected().map(d => {
      let x, y;
      const tooltipText = this.values.label[utils.getKey(d, dataKeys.label)];
      if (d.cLoc) {
        x = d.cLoc[0];
        y = d.cLoc[1];
      } else {
        const cLoc = _this._getPosition(d);
        if (cLoc) {
          x = cLoc[0];
          y = cLoc[1];
        }
      }
      const offset = _this.values.size[utils.getKey(d, dataKeys.size)] || 0;
      const color = _this.values.color[utils.getKey(d, dataKeys.color)] != null ? _this.cScale(_this.values.color[utils.getKey(d, dataKeys.color)]) : _this.COLOR_WHITEISH;
      _this._updateLabel(d, null, x, y, offset, color, tooltipText, duration);
    });
  },

  /*
   * UPDATE TIME:
   * Ideally should only update when time or data changes
   */
  updateTime() {
    const _this = this;

    this.time_1 = this.time == null ? this.model.time.value : this.time;
    this.time = this.model.time.value;
    this.duration = this.model.time.playing && (this.time - this.time_1 > 0) ? this.model.time.delayAnimations : 0;
    this.year.setText(this.model.time.formatDate(this.time), this.duration);

    //possibly update the exact value in size title
    this.updateTitleNumbers();
  },


  fitSizeOfTitles() {
    // reset font sizes first to make the measurement consistent
    const yTitleText = this.yTitleEl.select("text");
    yTitleText.style("font-size", null);

    const cTitleText = this.cTitleEl.select("text");
    cTitleText.style("font-size", null);

    const yTitleBB = yTitleText.node().getBBox();
    const cTitleBB = this.cTitleEl.classed("vzb-hidden") ? yTitleBB : cTitleText.node().getBBox();

    const font =
      Math.max(parseInt(yTitleText.style("font-size")), parseInt(cTitleText.style("font-size")))
      * this.width / Math.max(yTitleBB.width, cTitleBB.width);

    if (Math.max(yTitleBB.width, cTitleBB.width) > this.width) {
      yTitleText.style("font-size", font + "px");
      cTitleText.style("font-size", font + "px");
    } else {

      // Else - reset the font size to default so it won't get stuck
      yTitleText.style("font-size", null);
      cTitleText.style("font-size", null);
    }

  },

  profiles: {
    small: {
      margin: { top: 10, right: 10, left: 10, bottom: 0 },
      infoElHeight: 16,
      minRadiusPx: 0.5,
      maxRadiusEm: 0.05
    },
    medium: {
      margin: { top: 20, right: 20, left: 20, bottom: 30 },
      infoElHeight: 20,
      minRadiusPx: 1,
      maxRadiusEm: 0.05
    },
    large: {
      margin: { top: 30, right: 30, left: 30, bottom: 35 },
      infoElHeight: 22,
      minRadiusPx: 1,
      maxRadiusEm: 0.05
    }
  },

  presentationProfileChanges: {
    medium: {
      infoElHeight: 26
    },
    large: {
      infoElHeight: 32
    }
  },

  /**
   * Executes everytime the container or vizabi is resized
   * Ideally,it contains only operations related to size
   */
  updateSize() {
    this.activeProfile = this.getActiveProfile(this.profiles, this.presentationProfileChanges);

    const containerWH = this.root.getVizWidthHeight();
    this.activeProfile.maxRadiusPx = Math.max(
      this.activeProfile.minRadiusPx,
      this.activeProfile.maxRadiusEm * utils.hypotenuse(containerWH.width, containerWH.height)
    );

    const margin = this.activeProfile.margin;

    this.height = (parseInt(this.element.style("height"), 10) - margin.top - margin.bottom) || 0;
    this.width = (parseInt(this.element.style("width"), 10) - margin.left - margin.right) || 0;

    this.chartSvgAll
      .style("width", (this.width + margin.left + margin.right) + "px")
      .style("height", (this.height + margin.top + margin.bottom + (this.model.ui.map.overflowBottom || 0)) + "px");

    if (this.height <= 0 || this.width <= 0) return utils.warn("Bubble map updateSize() abort: vizabi container is too little or has display:none");
    
    const fullWidth = this.width + margin.left + margin.right;
    const fullHeight = Math.max(0, this.height + margin.top + margin.bottom + (this.model.ui.map.overflowBottom || 0));

    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.mainCanvas
      .style("width", fullWidth + "px")
      .style("height", fullHeight + "px")
      .attr("width", fullWidth * this.devicePixelRatio)
      .attr("height", fullHeight * this.devicePixelRatio);
    this.initCanvas(this.gl, this.prog, -margin.left, -margin.top, fullWidth, fullHeight, this.devicePixelRatio);

    this.hiddenCanvas
      .style("width", fullWidth + "px")
      .style("height", fullHeight + "px")
      .attr("width", fullWidth * this.devicePixelRatio)
      .attr("height", fullHeight * this.devicePixelRatio);
    this.initCanvas(this.pickingGl, this.pickingProg, -margin.left, -margin.top, fullWidth, fullHeight, this.devicePixelRatio);

    this.repositionElements();
  },

  mapBoundsChanged() {
    this.updateMarkerSizeLimits();
    this.redrawDataPoints(null, true);
    this.updateLabels(null);
  },

  repositionElements() {
    const margin = this.activeProfile.margin;
    const infoElHeight = this.activeProfile.infoElHeight;
    const isRTL = this.model.locale.isRTL();

    this.graphAll
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    this.year.setConditions({
      widthRatio: 2 / 10
    });
    this.year.resize(this.width, this.height + margin.bottom);

    this.yTitleEl
      .style("font-size", infoElHeight)
      .attr("transform", "translate(" + (isRTL ? this.width : 0) + "," + margin.top + ")");

    const yTitleBB = this.yTitleEl.select("text").node().getBBox();

    //hide the second line about color in large profile or when color is constant
    this.cTitleEl.attr("transform", "translate(" + (isRTL ? this.width : 0) + "," + (margin.top + yTitleBB.height) + ")")
      .classed("vzb-hidden", this.getLayoutProfile() === "large" || this.model.marker.color.use == "constant");

    const warnBB = this.dataWarningEl.select("text").node().getBBox();
    this.dataWarningEl.select("svg")
      .attr("width", warnBB.height * 0.75)
      .attr("height", warnBB.height * 0.75)
      .attr("x", -warnBB.width - warnBB.height * 1.2)
      .attr("y", -warnBB.height * 0.65);

    this.dataWarningEl
      .attr("transform", "translate(" + (this.width) + "," + (this.height - warnBB.height * 0.5) + ")")
      .select("text");

    if (this.yInfoEl.select("svg").node()) {
      const titleBBox = this.yTitleEl.node().getBBox();
      const t = utils.transform(this.yTitleEl.node());
      const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);

      this.yInfoEl.select("svg")
        .attr("width", infoElHeight)
        .attr("height", infoElHeight);
      this.yInfoEl.attr("transform", "translate("
        + hTranslate + ","
        + (t.translateY - infoElHeight * 0.8) + ")");
    }

    this.cInfoEl.classed("vzb-hidden", this.cTitleEl.classed("vzb-hidden"));

    if (!this.cInfoEl.classed("vzb-hidden") && this.cInfoEl.select("svg").node()) {
      const titleBBox = this.cTitleEl.node().getBBox();
      const t = utils.transform(this.cTitleEl.node());
      const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);

      this.cInfoEl.select("svg")
        .attr("width", infoElHeight)
        .attr("height", infoElHeight);
      this.cInfoEl.attr("transform", "translate("
        + hTranslate + ","
        + (t.translateY - infoElHeight * 0.8) + ")");
    }
  },


  updateMarkerSizeLimits() {
    const _this = this;
    const extent = this.model.marker.size.extent || [0, 1];

    if (!this.activeProfile) return utils.warn("updateMarkerSizeLimits() is called before ready(). This can happen if events get unfrozen and getFrame() still didn't return data");

    let minRadius = this.activeProfile.minRadiusPx;
    let maxRadius = this.activeProfile.maxRadiusPx;

    let minArea = utils.radiusToArea(Math.max(maxRadius * extent[0], minRadius));
    let maxArea = utils.radiusToArea(Math.max(maxRadius * extent[1], minRadius));

    let range = minArea === maxArea ? [minArea, maxArea] :
      d3.range(minArea, maxArea, (maxArea - minArea) / this.sScale.domain().length).concat(maxArea);

    this.sScale.range(range);
  },

  _mapIteract() {
    const _this = this;
    const d = {};
    return {
      _mouseover(key, i) {
        if (utils.isTouchDevice()
          || _this.model.ui.cursorMode !== "arrow"
          || _this.model.ui.map.showBubbles
          || !_this.map.keys[key]
        ) return;
        d[_this.KEY] = _this.map.keys[key];
        _this._interact()._mouseover(d);
      },
      _mouseout(key, i) {
        if (utils.isTouchDevice()
          || _this.model.ui.cursorMode !== "arrow"
          || _this.model.ui.map.showBubbles
          || !_this.map.keys[key]
        ) return;
        d[_this.KEY] = _this.map.keys[key];
        _this._interact()._mouseout(d);
      },
      _click(key, i) {
        if (utils.isTouchDevice()
          || _this.model.ui.cursorMode !== "arrow"
          || _this.model.ui.map.showBubbles
          || !_this.map.keys[key]
        ) return;
        d[_this.KEY] = _this.map.keys[key];
        _this._interact()._click(d);
      }
    };
  },

  _interact() {
    const _this = this;

    return {
      _mouseover(d, i) {
        if (_this.model.time.dragging) return;

        _this.model.marker.highlightMarker(d);

        _this.hovered = d;
        //put the exact value in the size title
        _this.updateTitleNumbers();
        _this.fitSizeOfTitles();

        if (_this.model.marker.isSelected(d)) { // if selected, not show hover tooltip
          _this._setTooltip();
        } else {
          //position tooltip
          _this._setTooltip(d);
        }
      },
      _mouseout(d, i) {
        if (_this.model.time.dragging) return;
        _this._setTooltip();
        _this.hovered = null;
        _this.updateTitleNumbers();
        _this.fitSizeOfTitles();
        _this.model.marker.clearHighlighted();
      },
      _click(d, i) {
        _this.model.marker.selectMarker(d);
      }
    };

  },


  highlightMarkers() {
    const _this = this;
    this.someHighlighted = (this.model.marker.highlight.length > 0);

    if (utils.isTouchDevice()) {
      if (this.someHighlighted) {
        _this.hovered = this.model.marker.highlight[0];
      } else {
        _this.hovered = null;
      }
      _this.updateTitleNumbers();
      _this.fitSizeOfTitles();
    }


//      if (!this.selectList || !this.someSelected) return;
//      this.selectList.classed("vzb-highlight", function (d) {
//          return _this.model.entities.isHighlighted(d);
//      });
//      this.selectList.each(function (d, i) {
//        d3.select(this).selectAll(".vzb-bmc-label-x")
//          .classed("vzb-invisible", function(n) {
//            return !_this.model.entities.isHighlighted(d);
//          });
//
//      });

  },

  _updateLabel(d, index, valueX, valueY, valueS, valueC, valueL, duration) {
    const _this = this;
    const KEY = this.KEY;
    if (d[KEY] == _this.druging) return;
    if (duration == null) duration = _this.duration;

    // only for selected entities
    if (_this.model.marker.isSelected(d)) {

      const showhide = d.hidden !== d.hidden_1;
      const valueLST = null;
      const cache = {};
      cache.labelX0 = valueX / this.width;
      cache.labelY0 = valueY / this.height;
      cache.scaledS0 = (valueS || valueS === 0) ? utils.areaToRadius(_this.sScale(valueS)) : null;
      cache.scaledC0 = valueC != null ? _this.cScale(valueC) : _this.COLOR_WHITEISH;
      const labelText = this.model.marker.getCompoundLabelText(d, this.values);

      this._labels.updateLabel(d, index, cache, valueX / this.width, valueY / this.height, 0, valueC, labelText, valueLST, duration, showhide);
    }
  },

  selectMarkers() {
    const _this = this;
    const KEY = this.KEY;
    this.someSelected = (this.model.marker.select.length > 0);

//      this._selectlist.rebuild();
    if (utils.isTouchDevice()) {
      _this._labels.showCloseCross(null, false);
      if (_this.someHighlighted) {
        _this.model.marker.clearHighlighted();
      } else {
        _this.updateTitleNumbers();
        _this.fitSizeOfTitles();
      }
    } else {
      // hide recent hover tooltip
      if (!_this.hovered || _this.model.marker.isSelected(_this.hovered)) {
        _this._setTooltip();
      }
    }

    this.nonSelectedOpacityZero = false;
  },

  _setTooltip(d) {
    if (d) {
      const KEY = this.KEY;
      const values = this.values;
      const labelValues = {};
      const tooltipCache = {};
      const cLoc = d.cLoc ? d.cLoc : this._getPosition(d);
      const mouse = d3.mouse(this.graph.node()).map(d => parseInt(d));
      const x = cLoc[0] || mouse[0];
      const y = cLoc[1] || mouse[1];
      labelValues.valueS = values.size[utils.getKey(d, this.dataKeys.size)];
      labelValues.labelText = this.model.marker.getCompoundLabelText(d, values);
      tooltipCache.labelX0 = labelValues.valueX = x / this.width;
      tooltipCache.labelY0 = labelValues.valueY = y / this.height;
      const offset = d.r || utils.areaToRadius(this.sScale(labelValues.valueS) || 0);
      tooltipCache.scaledS0 = d.r;
      tooltipCache.scaledC0 = null;

      this._labels.setTooltip(d, labelValues.labelText, tooltipCache, labelValues);
    } else {
      this._labels.setTooltip();
    }
  },

  preload() {
    return this.initMap();
  },

  initMap() {
    this.map = new MapEngine(this, "#vzb-map-background").getMap();
    return this.map.initMap();
  },

  //
  //webgl
  //

  _drawFunc() {
    this._drawPending = false;
    const data = this.bubbleContainer.selectAll("*").nodes()
      .filter(elem => elem.tagName !== "g" && elem.getAttribute("vzb-hidden") !== "true")
    this.draw(data, this.mainCanvas.node(), false);
  },

  _drawOnscreen(canvas, offCanvas, x, y, width, height) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(x, y, width, height);
    ctx.drawImage(offCanvas, x, y);
  },

  _canvasRedraw(duration, force) {
    const data = this.visibleBubblesSelection = this.bubbleContainer.selectAll("*").nodes()
      .filter(elem => elem.tagName !== "g" && elem.getAttribute("vzb-hidden") !== "true")

    const _drawAnimate = drawAnimate.bind(this);
    const _drawFunc = this._drawFunc.bind(this, data);

    if (duration) {
      !this.drawAnimFrame && (this.drawAnimFrame = requestAnimationFrame(_drawAnimate));
    } else {
      this.drawAnimFrame && cancelAnimationFrame(this.drawAnimFrame);
      this.drawAnimFrame = null;
      if (!this._drawPending) {
        this._drawPending = true;
        requestAnimationFrame(_drawFunc);
      }
    }

    function drawAnimate() {
      _drawFunc();
      this.drawAnimFrame = requestAnimationFrame(_drawAnimate);
    }
  },

  genColor() { 
    const ret = [];
    const _nextCol = this._nextCol;
    if(_nextCol < 16777215){         
      ret.push(_nextCol & 0xff); // R 
      ret.push((_nextCol & 0xff00) >> 8); // G 
      ret.push((_nextCol & 0xff0000) >> 16); // B
      this._nextCol += 99; 
    }
    return ret;
  },

  trackCanvasObject(x, y) {
    this.pickingDraw(d3.selectAll(this.visibleBubblesSelection), this.visibleBubblesSelection);
    const gl = this.pickingGl;
    const pixels = new Uint8Array(4);
    gl.readPixels(x, gl.drawingBufferHeight - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return this._colorToNode[pixels[0] + "," + pixels[1] + "," + pixels[2]];
  },

  initCanvas(gl, prog, translateX, translateY, width, height, devicePixelRatio) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    // Initialise uTransformToClipSpace
    gl.uniformMatrix3fv(gl.getUniformLocation(prog, "uTransformToClipSpace"), false, [
      2 / gl.drawingBufferWidth, 0, 0,
      0, - 2 / gl.drawingBufferHeight, 0,
      -1 - translateX * devicePixelRatio * 2 / gl.drawingBufferWidth,
      1 + translateY * devicePixelRatio * 2 / gl.drawingBufferHeight,
      1
    ]);
    
    gl.uniform1f(gl.getUniformLocation(prog, "uHeight"), gl.drawingBufferHeight);
    gl.uniform2f(gl.getUniformLocation(prog, "uTranslate"), translateX * devicePixelRatio, translateY * devicePixelRatio);
    gl.uniform1f(gl.getUniformLocation(prog, "uDevicePixelRatio"), devicePixelRatio);
    gl.uniform3fv(gl.getUniformLocation(prog, "uStrokeColor"), this.globalAttr.strokeColor);
    gl.uniform1f(gl.getUniformLocation(prog, "uStrokeWidth"), this.globalAttr.strokeWidth * devicePixelRatio);
    gl.uniform1f(gl.getUniformLocation(prog, "uStrokeOpacity"), this.globalAttr.strokeOpacity);
  },

  glInit(gl) {
    gl.getExtension('GL_OES_standard_derivatives');
    gl.getExtension('OES_standard_derivatives');
    gl.getExtension('OES_element_index_uint');
    // Load and compile the shaders
    const fragmentShader = this.createShader(gl, this.fragmentShader(), gl.FRAGMENT_SHADER);
    const vertexShader = this.createShader(gl, this.vertexShader(), gl.VERTEX_SHADER);

    // Create the WebGL program
    const prog = this.prog = gl.createProgram();
    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Global WebGL configuration
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Enable the attributes
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, "aPosition"));
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, "aCenter"));
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, "aRadius"));
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, "aColor"));

  },

  pickingGlInit(gl) {
    // Load and compile the shaders
    const fragmentShader = this.createShader(gl, this.pickingFragmentShader(), gl.FRAGMENT_SHADER);
    const vertexShader = this.createShader(gl, this.pickingVertexShader(), gl.VERTEX_SHADER);

    // Create the WebGL program
    const prog = this.pickingProg = gl.createProgram();
    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Global WebGL configuration
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // Enable the attributes
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, "aPosition"));
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, "aCenter"));
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, "aRadius"));
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, "aColor"));

  },

  attrib(gl, prog, attrib_name, size, offset, stride) {
    gl.vertexAttribPointer(gl.getAttribLocation(prog, attrib_name),
      size, gl.FLOAT, false, stride, offset);
  },

  draw(nodes) {
    const gl = this.gl;
    const prog = this.prog;

    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const data = this.loadData(nodes, 5, 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data.posData, gl.STATIC_DRAW);
    data.posData = null;

    this.attrib(gl, prog, "aPosition", 2, 0, 20);
    this.attrib(gl, prog, "aCenter", 2, 8, 20);
    this.attrib(gl, prog, "aRadius", 1, 16, 20);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data.colorData, gl.STATIC_DRAW);
    data.colorData = null;

    this.attrib(gl, prog, "aColor", 4, 0, 16);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indexData, gl.STATIC_DRAW);
    data.indexData = null;

    const offset = 0;
    const type = gl.UNSIGNED_INT;
    gl.drawElements(gl.TRIANGLES, data.vertexCount, type, offset);
  },

  pickingDraw(nodesSel, nodes) {
    const gl = this.pickingGl;
    const prog = this.pickingProg;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const data = this.pickingLoadData(nodesSel, nodes, 5, 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data.posData, gl.STATIC_DRAW);
    data.posData = null;

    this.attrib(gl, prog, "aPosition", 2, 0, 20);
    this.attrib(gl, prog, "aCenter", 2, 8, 20);
    this.attrib(gl, prog, "aRadius", 1, 16, 20);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data.colorData, gl.STATIC_DRAW);
    data.colorData = null;

    this.attrib(gl, prog, "aColor", 4, 0, 16);

    const offset = 0;
    gl.drawArrays(gl.TRIANGLES, offset, data.vertexCount);
  },
  
  loadData(nodes, pos_floats_per_bubble, color_floats_per_bubble) {
    const posData = new Float32Array(nodes.length * 3 * pos_floats_per_bubble);
    const colorData = new Float32Array(nodes.length * 3 * color_floats_per_bubble);
    const indexData = new Uint32Array(nodes.length * 3);
    const koeff = (1 + Math.sqrt(2));
    const halfStroke = this.globalAttr.strokeWidth * 0.5 + 1;
    
    //fill data for primitives - 1 triangle(3 vertexes) for bubble circle
    let baseIndex = 0;
    for (let i = 0, j = nodes.length, baseIndexPos = 0, baseIndexColor = 0, elemIndex = 0, x, y, x2, y2, dx, dy, rd, _x, _y, _rd, color, r, g, b, a; i < j; i++) {
      const elem = nodes[i];
      //x,y,r
      x = +elem.getAttribute("cx");
      y = +elem.getAttribute("cy");
      rd = +elem.getAttribute("r") + halfStroke;
      _x = x - rd;
      _y = y - rd;
      _rd = koeff * rd;

      posData[baseIndexPos++] = _x;
      posData[baseIndexPos++] = _y;
      posData[baseIndexPos++] = x;
      posData[baseIndexPos++] = y;
      posData[baseIndexPos++] = rd;

      posData[baseIndexPos++] = x + _rd;
      posData[baseIndexPos++] = _y;
      posData[baseIndexPos++] = x;
      posData[baseIndexPos++] = y;
      posData[baseIndexPos++] = rd;

      posData[baseIndexPos++] = _x;
      posData[baseIndexPos++] = y + _rd;
      posData[baseIndexPos++] = x;
      posData[baseIndexPos++] = y;
      posData[baseIndexPos++] = rd;

      //color r,g,b,a
      color = getColor(elem.getAttribute("fill"));
      colorData[baseIndexColor] = 
      colorData[baseIndexColor + 4] = 
      colorData[baseIndexColor + 8] = 
      r = +color[0] / 255;

      colorData[baseIndexColor + 1] = 
      colorData[baseIndexColor + 5] = 
      colorData[baseIndexColor + 9] = 
      g = +color[1] / 255;

      colorData[baseIndexColor + 2] = 
      colorData[baseIndexColor + 6] = 
      colorData[baseIndexColor + 10] = 
      b = +color[2] / 255;

      colorData[baseIndexColor + 3] = 
      colorData[baseIndexColor + 7] = 
      colorData[baseIndexColor + 11] = 
      a = +elem.getAttribute("opacity");

      baseIndexColor += 3 * color_floats_per_bubble;

      //index data
      indexData[baseIndex] = elemIndex++;
      indexData[baseIndex + 1] = elemIndex++;
      indexData[baseIndex + 2] = elemIndex++;
      
      baseIndex += 3;
    }

    return {
      posData,
      colorData,
      indexData,
      vertexCount: baseIndex
    };

    function getColor(color) {
      let c;
      if (color[0] === "#") {
        c = +("0x" + color.slice(1));
        return [
          (c & 0xff0000) >> 16,
          (c & 0xff00) >> 8,
          c & 0xff
        ];
      } else if (color.slice(0, 3) === "rgb") {
        return color.slice(4, -1).split(",");
      }
      return [0,0,0];
    }

    function normal(dx, dy) {
      return dy && 1.0 / Math.sqrt(1.0 + Math.pow(dx / dy, 2));
    }
  },

  pickingLoadData(nodesSel, nodes, pos_floats_per_bubble, color_floats_per_bubble) {
    const _this = this;
    const posData = new Float32Array(nodes.length * 3 * pos_floats_per_bubble);
    const colorData = new Float32Array(nodes.length * 3 * color_floats_per_bubble);
    const koeff = (1 + Math.sqrt(2));
    const halfStroke = this.globalAttr.strokeWidth * 0.5 + 1;

    //fill data for primitives - 1 triangle(3 vertexes) for bubble circle(trail circle)
    let baseIndexPos = 0, baseIndexColor = 0, x, y, rd, _x, _y, _rd, color;
    nodesSel.each(function(d) {
    //for (let i = 0, j = nodes.length, baseIndexPos = 0, baseIndexColor = 0, x, y, rd, _x, _y, _rd, color; i < j; i++) {
      const elem = this;
      //x,y,r
      x = +elem.getAttribute("cx");
      y = +elem.getAttribute("cy");
      rd = +elem.getAttribute("r") + halfStroke;
      _x = x - rd;
      _y = y - rd;
      _rd = koeff * rd;

      posData[baseIndexPos++] = _x;
      posData[baseIndexPos++] = _y;
      posData[baseIndexPos++] = x;
      posData[baseIndexPos++] = y;
      posData[baseIndexPos++] = rd;

      posData[baseIndexPos++] = x + _rd;
      posData[baseIndexPos++] = _y;
      posData[baseIndexPos++] = x;
      posData[baseIndexPos++] = y;
      posData[baseIndexPos++] = rd;

      posData[baseIndexPos++] = _x;
      posData[baseIndexPos++] = y + _rd;
      posData[baseIndexPos++] = x;
      posData[baseIndexPos++] = y;
      posData[baseIndexPos++] = rd;

      //color r,g,b,a
      if (d.__pickColor === undefined) {
        d.__pickColor = _this.genColor();
        _this._colorToNode[d.__pickColor.join(",")] = this;
      }
      color = d.__pickColor;

      colorData[baseIndexColor] = 
      colorData[baseIndexColor + 4] = 
      colorData[baseIndexColor + 8] = color[0] / 255;

      colorData[baseIndexColor + 1] = 
      colorData[baseIndexColor + 5] = 
      colorData[baseIndexColor + 9] = color[1] / 255;

      colorData[baseIndexColor + 2] = 
      colorData[baseIndexColor + 6] = 
      colorData[baseIndexColor + 10] = color[2] / 255;

      colorData[baseIndexColor + 3] = 
      colorData[baseIndexColor + 7] = 
      colorData[baseIndexColor + 11] = 1.0;

      baseIndexColor += 3 * color_floats_per_bubble;
    });

    return {
      posData,
      colorData,
      vertexCount: baseIndexPos / pos_floats_per_bubble
    };
    
  },

  createShader (gl, sourceCode, type) {
    // Compiles either a shader of type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
    var shader = gl.createShader( type );
    gl.shaderSource( shader, sourceCode );
    gl.compileShader( shader );
  
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog( shader );
      throw 'Could not compile WebGL program. \n\n' + info;
    }
    return shader;
  },

  pickingVertexShader() { return `
    uniform mat3 uTransformToClipSpace;
    uniform mediump float uDevicePixelRatio;

    attribute vec2 aPosition;
    attribute vec2 aCenter;
    attribute float aRadius;
    attribute vec4 aColor;

    varying vec3 vColor;
    varying vec2 vCenter;
    varying float vOpacity;
    varying float vRadius;    

    void main(void) {
      vec2 pos = (uTransformToClipSpace * vec3(aPosition * uDevicePixelRatio, 1.0)).xy;

      vCenter = aCenter * uDevicePixelRatio;
      vColor = (aColor).xyz;
      vOpacity = aColor.w;
      vRadius = aRadius * uDevicePixelRatio;

      gl_Position = vec4(pos, 0.0, 1.0);
    }  
  `},

  pickingFragmentShader() { return `
    //precision mediump float;
    uniform mediump float uHeight;
    uniform mediump vec2 uTranslate;

    varying mediump vec3 vColor;
    varying mediump vec2 vCenter;
    varying mediump float vOpacity;
    varying mediump float vRadius;    

    void main(void) {
      mediump float delta = 0.0, alpha = 1.0, stroke = 1.0;
      lowp vec2 pos = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
      lowp float distance = distance(vCenter - uTranslate, pos);
      
      if (distance > vRadius) discard;

      gl_FragColor = vec4(vColor,vOpacity);
    }  
  `},
  
  vertexShader() { return `
    uniform mat3 uTransformToClipSpace;
    uniform mediump float uDevicePixelRatio;

    attribute vec2 aPosition;
    attribute vec2 aCenter;
    attribute float aRadius;
    attribute vec4 aColor;

    varying vec3 vColor;
    varying vec2 vCenter;
    varying float vOpacity;
    varying float vRadius;    

    void main(void) {
      vec2 pos = (uTransformToClipSpace * vec3(aPosition * uDevicePixelRatio, 1.0)).xy;
      vCenter = aCenter * uDevicePixelRatio;
      vColor = (aColor).xyz;
      vOpacity = aColor.w;
      vRadius = aRadius * uDevicePixelRatio - 1.0;

      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `},

  fragmentShader() { return `
    #ifdef GL_OES_standard_derivatives
    #extension GL_OES_standard_derivatives : enable
    #endif

    //precision mediump float;
    uniform mediump vec3 uStrokeColor;
    uniform mediump float uStrokeWidth;
    uniform mediump float uStrokeOpacity;
    uniform mediump float uHeight;
    uniform mediump vec2 uTranslate;

    varying mediump vec3 vColor;
    varying mediump vec2 vCenter;
    varying mediump float vOpacity;
    varying mediump float vRadius;    

    void main(void) {
      mediump float delta = 0.0, alpha = 1.0, stroke = 1.0;
      lowp vec2 pos = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
      lowp float distance = distance(vCenter - uTranslate, pos);
      lowp float innerEdge = vRadius - uStrokeWidth * 0.5;
      
      #ifdef GL_OES_standard_derivatives
        delta = fwidth(distance);
        stroke = 1.0 - smoothstep(vRadius - delta, vRadius + delta, distance);
        alpha = smoothstep(innerEdge - delta, innerEdge + delta, distance);
      #endif
      gl_FragColor = vec4(mix(vColor, uStrokeColor, alpha), mix(vOpacity, vOpacity * uStrokeOpacity, alpha)) * stroke;

      //gl_FragColor = vec4(vColor,vOpacity);
    }
  `}

});

export default ExtApiMapComponent;
