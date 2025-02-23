import { 
  Chart,
  LabelSizeHelper,
  Utils,
  LegacyUtils as utils,
  Icons,
  ColorLegend,
  DateTimeBackground
} from "@vizabi/shared-components";
import * as d3 from "d3";
import { runInAction, decorate, computed} from "mobx";
import { BivariateColorLegend } from "./BivariateColorLegend.js";

import MapEngine from "./map";
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Deck, MapView } from "@deck.gl/core";
import LabelBackgroundLayer from "./layers/label-layer/label-background-layer/label-background-layer.js";
import LabelMultiIconLayer from "./layers/label-layer/label-multi-icon-layer/label-multi-icon-layer.js";
import LabelLayer from "./layers/label-layer/label-layer.js";

const {ICON_QUESTION} = Icons;
//const COLOR_BLACKISH = "rgb(51, 51, 51)";
const COLOR_WHITEISH = "rgb(253, 253, 253)";
const CHARACTER_SET =
'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖabcdefghijklmnopqrstuvwxyzåäéö0123456789+-−–*/%,.²:() '.split('');

const KEY = Symbol.for("key");
const TRAIL_KEY = Symbol.for("trailHeadKey");
const OPACITY_KEY = Symbol.for("opacity");
const R = Symbol("r");

const MAX_RADIUS_EM = 0.05;

const PROFILE_CONSTANTS = (width, height) => ({
  SMALL: {
    margin: { top: 10, right: 10, left: 10, bottom: 0 },
    infoElHeight: 16,
    minRadiusPx: 0.5,
    maxRadiusPx: Math.max(0.5, MAX_RADIUS_EM * utils.hypotenuse(width, height)),
  },
  MEDIUM: {
    margin: { top: 20, right: 20, left: 20, bottom: 30 },
    infoElHeight: 20,
    minRadiusPx: 1,
    maxRadiusPx: Math.max(0.5, MAX_RADIUS_EM * utils.hypotenuse(width, height)),
  },
  LARGE: {
    margin: { top: 30, right: 30, left: 30, bottom: 35 },
    infoElHeight: 22,
    minRadiusPx: 1,
    maxRadiusPx: Math.max(0.5, MAX_RADIUS_EM * utils.hypotenuse(width, height)),
  }
});

const PROFILE_CONSTANTS_FOR_PROJECTOR = () => ({
  MEDIUM: {
    infoElHeight: 26
  },
  LARGE: {
    infoElHeight: 32
  }
});

//BUBBLE MAP CHART COMPONENT
class _VizabiExtApiMap extends Chart {

  constructor(config) {

    config.template = `
      <div class="vzb-map-background"></div>
      <div class="vzb-map-foreground"></div>
      <svg class="vzb-extapimap-svg vzb-export">
          <g class="vzb-bmc-map-background"></g>
          <g class="vzb-bmc-graph">
              <g class="vzb-bmc-titles">
                <g class="vzb-bmc-date"></g>
                <g class="vzb-bmc-axis-s-title"><text></text></g>
                <g class="vzb-bmc-axis-c-title"><text></text></g>
                <g class="vzb-bmc-axis-a-title"><text></text></g>

                <g class="vzb-bmc-axis-s-info vzb-noexport"></g>
                <g class="vzb-bmc-axis-c-info vzb-noexport"></g>
                <g class="vzb-bmc-axis-a-info vzb-noexport"></g>
              </g>


              <g class="vzb-bmc-lines"></g>
              <g class="vzb-bmc-bubbles"></g>

              <g class="vzb-bmc-labels"></g>
              <rect class="vzb-bc-zoom-rect"></rect>
          </g>
      </svg>
      <div class="vzb-bmc-bivariate-legend vzb-invisible"></div>
      <div class="vzb-bmc-color-legend vzb-invisible"></div>
    `;

    config.subcomponents = [{
      type: LabelSizeHelper,
      placeholder: ".vzb-bmc-labels",      
      name: "labels"
    },{
      type: DateTimeBackground,
      placeholder: ".vzb-bmc-date"
    },{
      type: BivariateColorLegend,
      placeholder: ".vzb-bmc-bivariate-legend"
    },{
      type: ColorLegend,
      placeholder: ".vzb-bmc-color-legend",
      options: {
        colorModelName: "color_map",
        legendModelName: "legend_map"
      }
    }];

    super(config);

    this.hideAllLayers = false;
    this.activeObject = undefined;
    this.labelOffset = {};
    this.labelDragged = {};
    this.dragX0;
    this.dragY0;
    this.dragX;
    this.dragY;
    this.redrawUpdateTrigger = 0;
    this.opacityUpdateTrigger = 0;
    this.dataUpdateTrigger = 0;
  }

  setup() {
    this.DOM = {
      chartSvg: this.element.select("svg"),
      zoomRect: this.element.select(".vzb-bc-zoom-rect"),
      mapForeground: this.element.select(".vzb-map-foreground"),
    };
    this.DOM.chartSvg.select(".vzb-bmc-graph").call(graph => 
      Object.assign(this.DOM, {
        graph,
        titles: graph.select(".vzb-bmc-titles"),
        bubbleContainerCrop: graph.select(".vzb-bmc-bubbles-crop"),
        bubbleContainer: graph.select(".vzb-bmc-bubbles"),
        labelListContainer: graph.select(".vzb-bmc-bubble-labels"),
        sTitle: graph.select(".vzb-bmc-axis-s-title"),
        cTitle: graph.select(".vzb-bmc-axis-c-title"),
        aTitle: graph.select(".vzb-bmc-axis-a-title"),
        sInfo: graph.select(".vzb-bmc-axis-s-info"),
        cInfo: graph.select(".vzb-bmc-axis-c-info"),
        aInfo: graph.select(".vzb-bmc-axis-a-info"),
        bivariateLegend: this.element.select(".vzb-bmc-bivariate-legend"),
        colorAreaLegend: this.element.select(".vzb-bmc-color-legend"),
        year: graph.select(".vzb-bmc-date")
      })
    );

    this.bubblesDrawing = null;

    this.isMobile = utils.isMobileOrTablet();

    this._date = this.findChild({type: "DateTimeBackground"});
    this._date.setConditions({ xAlign: "left", yAlign: "bottom" });

    this._labels = this.findChild({type: "LabelSizeHelper"});

    const zoomOnWheel = function(event) {
      if (_this.ui.zoomOnScrolling) {
        const mouse = d3.pointer(event);
        _this._hideEntities();
        const mapZooming = _this.map.zooming + 1;
        _this.map.zoomMap(mouse, event.wheelDelta > 0 ? 1 : -1).then(
          (zooming) => {
            if (mapZooming !== zooming) return;
            _this._showEntities(100);
          }
        );
        event.stopPropagation();
        event.preventDefault();
        event.returnValue = false;
        return false;
      }
    };

    const _this = this;
    d3.select("body")
      .on("keydown", event => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (event.metaKey || event.ctrlKey) {
          _this.DOM.chartSvg.classed("vzb-zoomin", true);
          //_this.ui.set("cursorMode", "plus", false, false);
        }
      })
      .on("keyup", event => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (!event.metaKey && !event.ctrlKey) {
          _this.DOM.chartSvg.classed("vzb-zoomin", false);
          //_this.ui.set("cursorMode", "arrow", false, false);
        }
      })
      //this is for the case when user would press ctrl and move away from the browser tab or window
      //keyup event would happen somewhere else and won't be captured, so zoomin class would get stuck
      .on("mouseenter", event => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (!event.metaKey && !event.ctrlKey) {
          _this.ui.cursorMode = "arrow";
        }
      });

    this.root.element.on("custom-resetZoom.extapimap", () => {
      _this._hideEntities();
      _this.map.resetZoom(500).then(() => {
        _this._showEntities(300);
      });
    });

    this.FONT_FAMILY = this.element.style("font-family").split(",")[0];
    this.deckMap = this.getDeck();
    this.props = this.getProps();
    this.DOM.mapForeground.select("canvas").on("mouseleave", () => {
      if (this.MDL.highlighted.data.filter.any()) {
        this.MDL.highlighted.data.filter.clear();
      }
    });

    this.element.call(this._createMapDragger());
    this.element.on("mousewheel", zoomOnWheel)
      .on("wheel", zoomOnWheel);

  }

  get MDL(){
    return {
      frame: this.model.encoding.frame,
      selected: this.model.encoding.selected,
      highlighted: this.model.encoding.highlighted,
      superHighlighted: this.model.encoding.superhighlighted,
      size: this.model.encoding.size,
      color: this.model.encoding.color,
      mapColor: this.model.encoding.color_map,
      x: this.model.encoding.x, //for bivariate area colors
      y: this.model.encoding.y, //for bivariate area colors
      label: this.model.encoding.label,
      centroid: this.model.encoding.centroid,
      trail: this.model.encoding.trail
    };
  }

  draw(){
    this.localise = this.services.locale.auto({interval: this.MDL.frame.interval});

    this.treemenu = this.root.findChild({type: "TreeMenu"});

    // new scales and axes
    this.sScale = this.MDL.size.scale.d3Scale;
    this.cScale = color => color || color == 0 ? this.MDL.color.scale.d3Scale(color) : COLOR_WHITEISH;
    this.cMapScale = color => this.MDL.mapColor.scale.d3Scale(color);

    this.TIMEDIM = this.MDL.frame.data.concept;
    this.KEYS = this.model.data.space.filter(dim => dim !== this.TIMEDIM);

    if (this._updateLayoutProfile()) return; //return if exists with error

    runInAction(() => {
      this.preload().then(() => {
        if (this.map.inPreload) return;
        this.addReaction(this._filterFeatures);
        this.addReaction(this._updateSize);
        //this.addReaction(this._updateMarkerSizeLimits);
        //this.addReaction(this._getDuration);
        this.addReaction(this._updateLabelFontSizes);
        this.addReaction(this._updateSelected);
        this.addReaction(this._updateUIStrings);
        this.addReaction(this._drawData);
        this.addReaction(this._mapReady);
        this.addReaction(this._updateMap);
        //this.addReaction(this._updateMapColors);
        //this.addReaction(this._updateOpacity);
        this.addReaction(this._blinkSuperHighlighted);
        this.addReaction(this._redrawOpacity);
        this.addReaction(this._updateHighlighted);
        //this.addReaction(this._highlightDataPoints);
        //this.addReaction(this._selectDataPoints);
        //this.addReaction(this._redrawData);

        this.addReaction(this._setupCursorMode);
      });
    });
  }

  _filterFeatures() {
    if (this.ui.map.showAreas) {
      const keys = new Set(this.model.dataMapCache.values().map(m=>m[KEY]));
      this.__filteredFeatures = this.map.topojsonMap.mapFeature.features.filter(f => keys.has(f[KEY]));
    } else {
      this.__filteredFeatures = [];
    }
  }

  _mapReady() {
    this.status;
    runInAction(() => {
      this.map.ready();
    });
  }
  
  _updateLayoutProfile(){
    this.services.layout.size;

    this.height = (this.element.node().clientHeight) || 0;
    this.width = (this.element.node().clientWidth) || 0;
    
    this.profileConstants = this.services.layout.getProfileConstants(
      PROFILE_CONSTANTS(this.width, this.height), 
      PROFILE_CONSTANTS_FOR_PROJECTOR(this.width, this.height)
    );

    const margin = this.profileConstants.margin;
    this.chartHeight = this.height - margin.top - margin.bottom;
    this.chartWidth = this.width - margin.left - margin.right;
    if (!this.height || !this.width) return utils.warn("Chart _updateProfile() abort: container is too little or has display:none");

  }

  get duration() {
    return this.MDL.frame.playing ? this.MDL.frame.speed || 0 : 0;
  }

  _drawData() {
    this._updateMarkerSizeLimits();
    this._processFrameData();
    //this._createAndDeleteBubbles();
    if (this.model.encoding.frame.playing) {
      //requestAnimationFrame(() => {
        this.deckMap.setProps({layers: this.getMapLayers(this.__oldData)});
        requestAnimationFrame(() => {
          this.redrawUpdateTrigger++;
          this.deckMap.setProps({layers: this.getMapLayers(this.__oldData, true, 0.001)})
          requestAnimationFrame(() => {
            this.redrawUpdateTrigger++;
            this.__labelData = this.__newLabelData;
            this.deckMap.setProps({layers: this.getMapLayers(this.__data, true, this.duration)});
          });
        });
      //});
    } else {
      runInAction(() => {
        this.dataUpdateTrigger++;
        this._redrawData();
      });
    }
  }

  _redrawData(duration) {
    this.redrawUpdateTrigger++;
    this.deckMap.setProps({layers: this.getMapLayers()});
  }

  _redrawOpacity() {
    this.ui.opacityRegular;
    this.ui.opacitySelect;
    this.ui.opacitySelectDim;
    this.ui.opacityHighlight;
    this.ui.opacityHighlightDim;
    this.MDL.color.scale.d3Scale;
    this.MDL.mapColor.scale.d3Scale;

    this.opacityUpdateTrigger++;
    this.deckMap.setProps({layers: this.getMapLayers()});
  }

  _redrawData_(duration) {
    this.services.layout.size;
    
    //this._processFrameData();
    //this._createAndDeleteBubbles();

    const _this = this;
    if (!duration) duration = this.__duration;
    if (!this.bubbles) return utils.warn("redrawDataPoints(): no entityBubbles defined. likely a premature call, fix it!");

    this.bubbles.each(function(d) {
      const view = d3.select(this);

      d.r = utils.areaToRadius(_this.sScale(d.size)||0);
      d.center = _this._getPosition(d);

      d.hidden = (!d.size && d.size !== 0) || !d.center;

      if(d.center) {
        view
          .attr("cx", d.center[0])
          .attr("cy", d.center[1]);
      }
 
      view
        .classed("vzb-hidden", d.hidden);
        
      if (view.classed("vzb-hidden") !== d.hidden || !duration) {
        view
          .attr("r", d.r)
          .attr("fill", _this.cScale(d.color));
      } else {
        view.transition().duration(duration).ease(d3.easeLinear)
          .attr("r", d.r)
          .attr("fill", _this.cScale(d.color));
      }

      _this._updateLabel(d, duration);
    });
  }

  _updateLabel(d, duration) {
    if (!duration) duration = this.__duration;

    // only for selected entities
    if (this.MDL.selected.data.filter.has(d)) {

      const showhide = d.hidden !== d.hidden_1;
      const valueLST = null;
      const cache = {
        labelX0: d.center[0] / this.width,
        labelY0: d.center[1] / this.height,
        scaledS0: d.r,
        scaledC0: this.cScale(d.color),
        initTextBBox: null,
        initFontSize: null  
      };

      this._labels.updateLabel(d, cache, d.center[0] / this.width, d.center[1] / this.height, d.size, d.color, this.__labelWithoutFrame(d), valueLST, duration, showhide);
    }
  }

  _getPosition(d) {
    if (d.lat && d.lon) {
      return this.map.geo2Point(d.lon, d.lat);
    }
    if (d.centroid) {
      return this.map.centroid(d.centroid);
    }
    utils.warn("_getPosition(): was unable to resolve bubble positions either via lat/long or centroid");
    return [0,0];
  }

  getValue(d){
    return d;
  }

  _processFrameData() {
    if (!this.ui.map.showBubbles) {
      this.__data = this.model.dataArray;
      return;
    }
    let newData;
    if (this.MDL.trail?.show) {
      newData = this.model.dataArray.filter(d => {
        if (d[TRAIL_KEY]) return false;
        d[R] = utils.areaToRadius(this.sScale(d.size) || 0);
        return true;
      });
    } else {
      newData = this.model.dataArray;
      newData.forEach(d => {
        d[R] = utils.areaToRadius(this.sScale(d.size) || 0);
      });
    }
    this.__newLabelData = this.__selectedKeys.map(key => this.model.dataMap.get(key));
    if (this.model.encoding.frame.playing) {
      this.__oldData = this.resortData(this.__data, newData);
    } else {
      this.__labelData = this.__newLabelData;
    }
    this.__data = newData;
  }

  resortData(data, newData) {
    const keyToIndex = {};
    data.forEach((d, i) => {
        keyToIndex[d[KEY]] = d;
    });
    return newData.map(d => {
      return keyToIndex[d[KEY]] || Object.assign({ [OPACITY_KEY]: 0 }, d);
    });
  }


  _createAndDeleteBubbles() {

    this.bubbles = this.DOM.bubbleContainer.selectAll(".vzb-bmc-bubble")
      .data(!this.ui.map.showBubbles ? [] : this.__dataProcessed, d => d[Symbol.for("key")]);

    //exit selection
    this.bubbles.exit().remove();

    //enter selection -- init circles
    this.bubbles = this.bubbles.enter().append("circle")
      .attr("class", "vzb-bmc-bubble")
      .attr("id", (d) => `vzb-br-bar-${d[Symbol.for("key")]}-${this.id}`)
      .merge(this.bubbles);

    if(!utils.isTouchDevice()){
      this.bubbles
        .on("mousedown", this._interact().mousedown)
        .on("mousemove", this._interact().mouseover)
        .on("mouseout", this._interact().mouseout)
        .on("click", this._interact().click);
    } else {
      this.bubbles
        .on("tap", this._interact().tap);
    }
  }

  _interact() {
    const _this = this;

    return {
      mousedown(event) {
        if (_this.ui.cursorMode === "arrow") event.stopPropagation();
      },
      mouseover(event, d) {
        if (_this.ui.panWithArrow && !event.shiftKey || _this.zooming || _this.map.zooming || _this.ui.cursorMode !== "arrow" || _this.MDL.frame.dragging) return;

        const filter = _this.MDL.highlighted.data.filter;
        if(!filter.has(d)){
          _this.hovered = d;
          filter.clear();
          filter.set(d);
          _this._labels.showCloseCross(d, true);
        }
        //put the exact value in the size title
        //this.updateTitleNumbers();
        //_this.fitSizeOfTitles();       
      },
      mouseout(event, d) {
        if (_this.zooming || _this.map.zooming ||_this.ui.cursorMode !== "arrow" || _this.MDL.frame.dragging) return;

        _this.hovered = null;
        _this.MDL.highlighted.data.filter.delete(d);
        _this._labels.showCloseCross(d, false);
        //_this.updateTitleNumbers();
        //_this.fitSizeOfTitles();
      },
      click(event, d) {
        if (_this.zooming || _this.map.zooming ||_this.ui.cursorMode !== "arrow") return;

        _this.MDL.selected.data.filter.toggle(d);
      },
      tap(event, d) {
        if (_this.zooming || _this.map.zooming ||_this.ui.cursorMode !== "arrow") return;

        _this.MDL.selected.data.filter.toggle(d);
        event.stopPropagation();
      }
    };
  }

  _getMarkerItemForArea(id) {
    if (!id) return undefined;

    const d = Object.assign({}, this.model.dataMap.get(id));
    d.r = 3;
    d.center = this._getPosition(d);
    d.hidden = !d.center;

    return  d;
  }

  _mapInteract() {
    const _this = this;
    return {
      _mouseover(event, key) {
        if (utils.isTouchDevice()
          || _this.ui.cursorMode !== "arrow"
          || _this.ui.map.showBubbles
          || !_this.map.keys[key]
        ) return;
        _this._interact().mouseover(event, _this._getMarkerItemForArea(_this.map.keys[key]));
      },
      _mouseout(event, key) {
        if (utils.isTouchDevice()
          || _this.ui.cursorMode !== "arrow"
          || _this.ui.map.showBubbles
          || !_this.map.keys[key]
        ) return;
        _this._interact().mouseout(event, _this._getMarkerItemForArea(_this.map.keys[key]));
      },
      _click(event, key) {
        if (utils.isTouchDevice()
          || _this.ui.cursorMode !== "arrow"
          || _this.ui.map.showBubbles
          || !_this.map.keys[key]
        ) return;
        _this._interact().click(event, _this._getMarkerItemForArea(_this.map.keys[key]));
      }
    };
  }


  repositionElements() {
    const margin = this.profileConstants.margin;
    const infoElHeight = this.profileConstants.infoElHeight;
    const verticalSpacing = infoElHeight * 1.2;
    const isRTL = this.services.locale.isRTL();

    this.DOM.titles
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    this._date.setConditions({
      widthRatio: 2 / 10
    });
    this._date.resize(this.width, this.height - margin.top);

    //TITLES

    //hide the first line about bubble size when no bubbles
    const hideSTitle = !this.ui.map.showBubbles;
    this.DOM.sTitle
      .attr("transform", "translate(" + (isRTL ? this.chartWidth : 0) + "," + margin.top + ")")
      .classed("vzb-hidden", hideSTitle);

    //hide the second line about color in large profile or when color is constant or no bubbles
    const hideCTitle = this.services.layout.profile === "LARGE" || this.MDL.color.data.isConstant || !this.ui.map.showBubbles;
    this.DOM.cTitle
      .attr("transform", "translate(" + (isRTL ? this.chartWidth : 0) + "," + (margin.top + (hideSTitle ? 0 : verticalSpacing)) + ")")
      .classed("vzb-hidden", hideCTitle);

    //hide the second line about color in large profile or when color is constant or no bubbles
    const hideATitle = !this.ui.map.showAreas || this.ui.map.useBivariateColorScaleWithDataFromXY;
    this.DOM.aTitle
      .attr("transform", "translate(" + (isRTL ? this.chartWidth : 0) + "," + (margin.top + (hideSTitle ? 0 : verticalSpacing) + (hideCTitle ? 0 : verticalSpacing)) + ")")
      .classed("vzb-hidden", hideATitle);

    // INFO ELEMENTS

    this.DOM.cInfo.classed("vzb-hidden", hideSTitle);  

    if (!hideSTitle && this.DOM.sInfo.select("svg").node()) {
      const titleBBox = this.DOM.sTitle.node().getBBox();
      const t = utils.transform(this.DOM.sTitle.node());
      const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);

      this.DOM.sInfo
        .attr("transform", `translate(${hTranslate},${t.translateY - verticalSpacing * 0.8})`)
        .select("svg")
        .attr("width", infoElHeight)
        .attr("height", infoElHeight);
    }

    this.DOM.cInfo.classed("vzb-hidden", hideCTitle);

    if (!hideCTitle && this.DOM.cInfo.select("svg").node()) {
      const titleBBox = this.DOM.cTitle.node().getBBox();
      const t = utils.transform(this.DOM.cTitle.node());
      const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);

      this.DOM.cInfo  
        .attr("transform", `translate(${hTranslate},${t.translateY - verticalSpacing * 0.8})`)
        .select("svg")
        .attr("width", infoElHeight)
        .attr("height", infoElHeight);
    }

    this.DOM.aInfo.classed("vzb-hidden", hideATitle);

    if (!hideATitle && this.DOM.aInfo.select("svg").node()) {
      const titleBBox = this.DOM.aTitle.node().getBBox();
      const t = utils.transform(this.DOM.cTitle.node());
      const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);

      this.DOM.aInfo  
        .attr("transform", `translate(${hTranslate},${t.translateY - verticalSpacing * 0.8})`)
        .select("svg")
        .attr("width", infoElHeight)
        .attr("height", infoElHeight);
    }

    const hideBivariateLegend = !this.ui.map.useBivariateColorScaleWithDataFromXY || !this.ui.map.showAreas;
    this.DOM.bivariateLegend
      .style("font-size", infoElHeight + "px")
      .style("top", (margin.top + (hideSTitle ? 0 : verticalSpacing) + (hideCTitle ? 0 : verticalSpacing) + (hideATitle ? 0 : verticalSpacing)) + "px")
      .style(isRTL ? "right" : "left", (isRTL ? margin.right : margin.left) + "px")
      .classed("vzb-invisible", hideBivariateLegend);

    const hideColorAreaLegend = this.ui.map.useBivariateColorScaleWithDataFromXY || !this.ui.map.showAreas;
    this.DOM.colorAreaLegend
      //.style("font-size", infoElHeight + "px")
      .style("top", (margin.top + (hideSTitle ? 0 : verticalSpacing) + (hideCTitle ? 0 : verticalSpacing) + (hideATitle ? 0 : verticalSpacing * 1.2)) + "px")
      .style(isRTL ? "right" : "left", (isRTL ? margin.right : margin.left) + "px")
      .classed("vzb-invisible", hideColorAreaLegend);
  }

  _updateMapColors() {
    this.MDL.x?.scale?.zoomed;
    this.MDL.y?.scale?.zoomed;
    this.map.updateColors();
  }

  _updateMap() {
    this.ui.map.showAreas;
    this.ui.map.showMap;
    this.ui.map.mapStyle;

    this.map.layerChanged();
  }

  _updateMarkerSizeLimits() {
    //this is very funny
    this.services.layout.size;
    this.MDL.size.scale.domain;

    const {
      minRadiusPx: minRadius,
      maxRadiusPx: maxRadius
    } = this.profileConstants;

    const extent = this.MDL.size.scale.extent || [0, 1];

    let minArea = utils.radiusToArea(Math.max(maxRadius * extent[0], minRadius));
    let maxArea = utils.radiusToArea(Math.max(maxRadius * extent[1], minRadius));

    this.sScale.range([minArea, maxArea]);
  }

  _updateUIStrings() {
    const {
      size, color, mapColor
    } = this.MDL;

    const isRTL = this.services.locale.isRTL();

    this.strings = {
      title: {
        S: Utils.getConceptName(size, this.localise), 
        C: Utils.getConceptName(color, this.localise),
        A: Utils.getConceptName(mapColor, this.localise)
      }
    };

    this.DOM.sTitle
      .classed("vzb-disabled", this.treemenu.state.ownReadiness !== Utils.STATUS.READY)
      .select("text").text(this.localise("buttons/size") + ": " + this.strings.title.S)
      .on("click", () => {
        this.treemenu
          .encoding("size")
          .alignX(isRTL ? "right" : "left")
          .alignY("top")
          .updateView()
          .toggle();
      });

    this.DOM.cTitle
      .classed("vzb-disabled", this.treemenu.state.ownReadiness !== Utils.STATUS.READY)
      .select("text").text(this.localise("buttons/color") + ": " + this.strings.title.C)
      .on("click", () => {
        this.treemenu
          .encoding("color")
          .alignX(isRTL ? "right" : "left")
          .alignY("top")
          .updateView()
          .toggle();
      });

    this.DOM.aTitle
      .classed("vzb-disabled", this.treemenu.state.ownReadiness !== Utils.STATUS.READY)
      .select("text").text(this.localise("buttons/mapcolors") + ": " + this.strings.title.A)
      .on("click", () => {
        this.treemenu
          .encoding("color_map")
          .alignX(isRTL ? "right" : "left")
          .alignY("top")
          .updateView()
          .toggle();
      });

    const toolRect = this.root.element.node().getBoundingClientRect();
    const chartRect = this.element.node().getBoundingClientRect();

    this._drawInfoEl(this.DOM.sInfo, this.DOM.sTitle, this.MDL.size, {x: chartRect.left - toolRect.left});
    this._drawInfoEl(this.DOM.cInfo, this.DOM.cTitle, this.MDL.color);
    this._drawInfoEl(this.DOM.aInfo, this.DOM.aTitle, this.MDL.mapColor);
  }

  _drawInfoEl(element, titleElement, model, posOffset = {}){
    const dataNotes = this.root.findChild({type: "DataNotes"});
    const conceptProps = model.data.conceptProps;
    const infoElHeight = this.profileConstants.infoElHeight;

    element
      .on("click", () => {
        dataNotes.pin();
      })
      .on("mouseover", function() {
        const rect = this.getBBox();
        const ctx = utils.makeAbsoluteContext(this, this.farthestViewportElement);
        const coord = ctx(rect.x - 10, rect.y + rect.height + 10);
        dataNotes
          .setEncoding(model)
          .show()
          .setPos(coord.x + posOffset.x || 0, coord.y + posOffset.y || 0);
      })
      .on("mouseout", () => {
        dataNotes.hide();
      })
      .html(ICON_QUESTION)
      .select("svg")
      .attr("width", infoElHeight + "px").attr("height", infoElHeight + "px")
      .classed("vzb-hidden", 
        !conceptProps?.description && !conceptProps?.sourceLink || titleElement.classed("vzb-hidden")
      );
  }

  _updateSize() {
    this.services.layout.size;

    this.DOM.chartSvg
      .style("width", this.width + "px")
      .style("height", this.height + (this.ui.map.overflowBottom || 0) + "px");

    runInAction(() => {
      this.map.rescaleMap();
    });

    this.repositionElements();
  }

  // show size number on title when hovered on a bubble
  updateTitleNumbers() {
    const _this = this;

    let mobile; // if is mobile device and only one bubble is selected, update the sTitle for the bubble
    if (_this.isMobile && _this.model.marker.select && _this.model.marker.select.length === 1) {
      mobile = _this.model.marker.select[0];
    }

    if (_this.hovered || mobile) {
      const conceptPropsS = _this.model.marker.size.getConceptprops();
      const conceptPropsC = _this.model.marker.color.getConceptprops();
      const conceptPropsA = _this.model.marker.mapColor.getConceptprops();

      const hovered = _this.hovered || mobile;
      const formatterS = _this.model.marker.size.getTickFormatter();
      const formatterC = _this.model.marker.color.getTickFormatter();

      const unitS = conceptPropsS.unit || "";
      const unitC = conceptPropsC.unit || "";
      const unitA = conceptPropsA.unit || "";

      const valueS = _this.values.size[utils.getKey(hovered, _this.dataKeys.size)];
      let valueC = _this.values.color[utils.getKey(hovered, _this.dataKeys.color)];
      let valueA = _this.values.color[utils.getKey(hovered, _this.dataKeys.map_color)];

      //resolve value for color from the color legend model
      if (_this.model.marker.color.isDiscrete() && valueC) {
        valueC = this.model.marker.color.getColorlegendMarker().label.getItems()[valueC] || "";
      }

      _this.DOM.sTitle.select("text")
        .text(_this.localise("buttons/size") + ": " + formatterS(valueS) + " " + unitS);

      _this.DOM.cTitle.select("text")
        .text(_this.localise("buttons/color") + ": " +
          (valueC || valueC === 0 ? formatterC(valueC) + " " + unitC : _this.localise("hints/nodata")));

      _this.DOM.aTitle.select("text")
        .text(_this.localise("buttons/mapcolors") + ": " +
          (valueA || valueA === 0 ? formatterC(valueA) + " " + unitA : _this.localise("hints/nodata")));
  

      this.DOM.sInfo.classed("vzb-hidden", true);
      this.DOM.cInfo.classed("vzb-hidden", true);
      this.DOM.aInfo.classed("vzb-hidden", true);
    } else {
      this.DOM.sTitle.select("text")
        .text(this.localise("buttons/size") + ": " + this.strings.title.S);
      this.DOM.cTitle.select("text")
        .text(this.localise("buttons/color") + ": " + this.strings.title.C);
      this.DOM.aTitle.select("text")
        .text(this.localise("buttons/mapcolors") + ": " + this.strings.title.A);


      this.DOM.sInfo.classed("vzb-hidden", this.DOM.sTitle.classed("vzb-hidden"));
      this.DOM.cInfo.classed("vzb-hidden", this.DOM.cTitle.classed("vzb-hidden"));
      this.DOM.aInfo.classed("vzb-hidden", this.DOM.aTitle.classed("vzb-hidden"));
    }
  }

  fitSizeOfTitles() {
    // reset font sizes first to make the measurement consistent
    const sTitleText = this.DOM.sTitle.select("text").style("font-size", null);
    const cTitleText = this.DOM.cTitle.select("text").style("font-size", null);
    const aTitleText = this.DOM.aTitle.select("text").style("font-size", null);

    const maxTextW = d3.max([
      this.DOM.sTitle.classed("vzb-hidden") ? null : sTitleText.node().getBBox().width,
      this.DOM.cTitle.classed("vzb-hidden") ? null : cTitleText.node().getBBox().width,
      this.DOM.cTitle.classed("vzb-hidden") ? null : aTitleText.node().getBBox().width,
    ]);

    const maxFontSize = d3.max([
      parseInt(sTitleText.style("font-size")),
      parseInt(cTitleText.style("font-size")),
      parseInt(aTitleText.style("font-size")),
    ]);

    const font = maxTextW > this.width ? maxFontSize * this.width / maxTextW + "px" : null;

    sTitleText.style("font-size", font);
    cTitleText.style("font-size", font);
    aTitleText.style("font-size", font);
  }

  _getDuration() {
    //smooth animation is needed when playing, except for the case when time jumps from end to start
    if(!this.MDL.frame) return 0;
    this.frameValue_1 = this.frameValue;
    this.frameValue = this.MDL.frame.value;
    return this.__duration = this.MDL.frame.playing && (this.frameValue - this.frameValue_1 > 0) ? this.MDL.frame.speed : 0;

    //this._updateForecastOverlay();

    //possibly update the exact value in size title
    //this.updateTitleNumbers();
  }

  _updateOpacity() {
    this.MDL.frame.value; //listen

    this.someHighlighted = this.MDL.highlighted.data.filter.any() || this.MDL.superHighlighted.data.filter.any();
    this.someSelected = this.MDL.selected.data.filter.any();

    if (this.ui.map.showAreas)
      this.map.updateOpacity();

    if (this.ui.map.showBubbles)
      this.bubbles.style("opacity", d => this.getOpacity(d));
  }

  _blinkSuperHighlighted() {
    if (!this.MDL.superHighlighted || !this.ui.map.showBubbles) return;

    const superHighlightFilter = this.MDL.superHighlighted.data.filter;

    // this.bubbles
    //   .classed("vzb-super-highlighted", d => superHighlightFilter.has(d));
  }

  _drawForecastOverlay() {
    this.DOM.forecastOverlay.classed("vzb-hidden", 
      !this.MDL.frame.endBeforeForecast || 
      !this.ui.showForecastOverlay || 
      (this.MDL.frame.value <= this.MDL.frame.endBeforeForecast)
    );
  }

  _hideEntities(duration) {
    this.hideAllLayers = true;
    this.deckMap.setProps({layers: this.getMapLayers()});
  }

  _showEntities(duration) {
    this.hideAllLayers = false;
    this.deckMap.setProps({layers: this.getMapLayers()});
  }

  mapBoundsChanged() {
    this._redrawData();
    //this.updateMarkerSizeLimits();
    //this.redrawDataPoints(null, true);
    if (!this.ui.map.showBubbles) {
      // //this.updateLabels(null);
    }
  }

  updateLabels() {
    const selectedFilter = this.MDL.selected.data.filter;
    for (const key of selectedFilter.markers.keys()) {
      this._updateLabel(this.ui.map.showBubbles ? this.model.dataMap.get(key) : this._getMarkerItemForArea(key));
    }
  }

  getMapOpacity(key) {
    if (this.ui.map.showBubbles)
      return this.ui.opacitySelectDim;
      
    return this.getOpacity( {[Symbol.for("key")]: key} );
  }

  getOpacity(d) {
    const {
      opacityHighlightDim,
      opacitySelectDim,
      opacityRegular,
    } = this.ui;
    
    //if (this.MDL.highlighted.data.filter.has(d) || this.MDL.superHighlighted.data.filter.has(d)) return opacityRegular;
    if (this.MDL.highlighted.data.filter.has(d)) return opacityRegular;
    if (this.MDL.selected.data.filter.has(d)) return opacityRegular;

    if (this.__someSelected) return opacitySelectDim;
    if (this.__someHighlighted) return opacityHighlightDim;

    return opacityRegular;
  }

  _setTooltip(event, d) {
    if (d) {
      const labelValues = {};
      const tooltipCache = {};
      const cLoc = d.cLoc ? d.cLoc : this._getPosition(d);
      const mouse = d3.pointer(event);
      const x = cLoc[0] || mouse[0];
      const y = cLoc[1] || mouse[1];
      const offset = d.r || 0;

      labelValues.valueS = d.size;
      labelValues.labelText = this.__labelWithoutFrame(d);
      tooltipCache.labelX0 = labelValues.valueX = x / this.width;
      tooltipCache.labelY0 = labelValues.valueY = y / this.height;
      tooltipCache.scaledS0 = offset;
      tooltipCache.scaledC0 = null;

      this._labels.setTooltip(d, labelValues.labelText, tooltipCache, labelValues);
    } else {
      this._labels.setTooltip();
    }
  }

  __labelWithoutFrame(d) {
    if (typeof d.label == "object") return Object.values(d.label).join(", ");
    if (d.label != null) return "" + d.label;
    return d[Symbol.for("key")];
  }

  _updateHighlighted() {
    const highlightedFilter = this.MDL.highlighted.data.filter;

    this.__someHighlighted = highlightedFilter.any();
    this.__highlightedMarkers = new Map(highlightedFilter.markers);
    this.activeObject = this.__highlightedMarkers.size == 1 ? Object.assign({}, this.model.dataMap.get(this.__highlightedMarkers.keys().next().value)) : null;
    this.activeObjectData = this.activeObject ? [this.activeObject] : [];
    this.opacityUpdateTrigger++;
    this.deckMap.setProps({layers: this.getMapLayers()})
  }

  _updateSelected() {
    const selectedFilter = this.MDL.selected.data.filter;
    
    this.__someSelected = selectedFilter.any();
    this.__selectedMarkers = new Map(selectedFilter.markers);
    this.__selectedKeys = [...this.__selectedMarkers.keys()];

    this.labelZScale = d3.scaleLinear([0, this.__selectedMarkers.size - 1],[-10, -1]);
    
    Object.keys(this.labelOffset).forEach(key => {
      if (!this.__selectedMarkers.has(key)) delete this.labelOffset[key];
    });
    Object.keys(this.labelDragged).forEach(key => {
      if (!this.__selectedMarkers.has(key)) delete this.labelDragged[key];
    });

    runInAction(() => {
      if (!this.ui.map.showBubbles || !this.MDL.trail?.show) {
        this.__labelData = this.__selectedKeys.map(key => this.model.dataMap.get(key));
        this.deckMap.setProps({layers: this.getMapLayers()});
      }
    });
  }

  _highlightDataPoints() {
    const highlightedFilter = this.MDL.highlighted.data.filter;
    const selectedFilter = this.MDL.selected.data.filter;
    this.someHighlighted = highlightedFilter.any();

    if (highlightedFilter.markers.size === 1) {
      const highlightedKey = highlightedFilter.markers.keys().next().value;
      const d = this.ui.map.showBubbles ? this.model.dataMap.get(highlightedKey) : this._getMarkerItemForArea(highlightedKey);
      const selectedKey = d[Symbol.for("key")];

      //show tooltip
      const isSelected = selectedFilter.has(selectedKey);
      const text = isSelected ? "": this.__labelWithoutFrame(d);
      
      this._labels.highlight(null, false);
      this._labels.highlight({ [Symbol.for("key")]: selectedKey }, true);

      //set tooltip and show axis projections
      if (text) {
        this._setTooltip({}, d);
      } else {
        this._setTooltip();
      }

    } else {
      this._setTooltip();
      this._labels.highlight(null, false);
    }

  }

  _selectDataPoints() {
    this.updateLabels();
  }

  _setupCursorMode() {
    const wrapper = this.DOM.mapForeground;
    if (this.ui.cursorMode === "plus") {
      wrapper.classed("vzb-zoomin", true);
      wrapper.classed("vzb-zoomout", false);
      wrapper.classed("vzb-panhand", false);
      this.deckMap.setProps({ _pickable: false });
    } else if (this.ui.cursorMode === "minus") {
      wrapper.classed("vzb-zoomin", false);
      wrapper.classed("vzb-zoomout", true);
      wrapper.classed("vzb-panhand", false);
      this.deckMap.setProps({ _pickable: false });
    } else if (this.ui.cursorMode === "hand") {
      wrapper.classed("vzb-zoomin", false);
      wrapper.classed("vzb-zoomout", false);
      wrapper.classed("vzb-panhand", true);
      this.deckMap.setProps({ _pickable: true });
    } else {
      wrapper.classed("vzb-zoomin", false);
      wrapper.classed("vzb-zoomout", false);
      wrapper.classed("vzb-panhand", false);
      this.deckMap.setProps({ _pickable: true });
    }
  }

  _updateLabelFontSizes() {
    this._labels.MDL.size_label.scale.extent;

    this.__defaultFontSize = this._labels.defaultFontSize;
    this.__isConstantFontSize = this._labels.MDL.size_label.data.isConstant;
    this.__fontSize = this._labels.getFontSize(this._labels.MDL.size_label.data.constant);
    this.deckMap.setProps({layers: this.getMapLayers()})
  }

  _createMapDragger() {
    const _this = this;
    let labelDragging = false;
    return d3.drag()
      .on("start", function(event) {
        if (
          ((event.sourceEvent.metaKey || event.sourceEvent.ctrlKey) && _this.ui.cursorMode == "arrow") ||
          _this.ui.cursorMode == "plus"

        ) {
          _this.dragAction = "zooming";
          _this.zooming = true;
          const mouse = d3.pointer(event, _this.DOM.graph.node());
          _this.origin = {
            x: mouse[0],
            y: mouse[1]
          };
          _this.DOM.zoomRect.classed("vzb-invisible", false);
        } else if (
          _this.ui.cursorMode == "hand" ||
          (_this.ui.panWithArrow && _this.ui.cursorMode === "arrow")
        ) {
          _this.dragAction = "panning0";
          _this.DOM.chartSvg.classed("vzb-zooming", true);
        }
      })
      .on("drag", function(event) {
        switch (_this.dragAction) {
        case "zooming": {
          const mouse = d3.pointer(event, _this.DOM.graph.node());
          _this.DOM.zoomRect
            .attr("x", Math.min(mouse[0], _this.origin.x))
            .attr("y", Math.min(mouse[1], _this.origin.y))
            .attr("width", Math.abs(mouse[0] - _this.origin.x))
            .attr("height", Math.abs(mouse[1] - _this.origin.y));
          break;
        }
        case "panning0": {
          _this.dragAction = "panning";
          if (_this.__labelDragging) {
            labelDragging = true;
            return;
          }
          //_this._hideEntities();
          _this.map.panStarted();
        }
        case "panning": {
          if (labelDragging) return;
          _this.map.moveOver(event.dx, event.dy);
          break;
        }
        }
      })
      .on("end", function(event) {
        switch (_this.dragAction) {
        case "zooming":
          _this.DOM.zoomRect
            .attr("width", 0)
            .attr("height", 0)
            .classed("vzb-invisible", true);
          if (_this.zooming) {
            const mouse = d3.pointer(event, _this.DOM.graph.node());
            if (Math.abs(_this.origin.x - mouse[0]) < 5 || Math.abs(_this.origin.y - mouse[1]) < 5) {
              _this._hideEntities();
              const mapZooming = _this.map.zooming + 1;
              _this.map.zoomMap(mouse, 1).then(
                (zooming) => {
                  if (mapZooming !== zooming) return;
                  _this._showEntities(300);
                }
              );
            } else {
              _this.map.zoomRectangle(_this.origin.x, _this.origin.y, mouse[0], mouse[1]);
            }
          }
          break;
        case "panning":
          _this.DOM.chartSvg.classed("vzb-zooming", false);
          if (labelDragging) {
            labelDragging = false;
            return; 
          }  
          _this.map.panFinished();
          if (_this.hideAllLayers) _this._showEntities(300);
          break;
        }
        if (_this.ui.cursorMode == "minus") {
          const mouse = d3.pointer(event, _this.DOM.graph.node());
          _this._hideEntities();
          const mapZooming = _this.map.zooming + 1;
          _this.map.zoomMap(mouse, -1).then(
            (zooming) => {
              if (mapZooming !== zooming) return;
              _this._showEntities(300);
            }
          );
        }
        _this.dragAction = null;
        _this.zooming = false;
      });
  }

  preload() {
    if (this.map) return Promise.resolve();
    return this._initMap();
  }

  _initMap() {
    this.map = new MapEngine(this, ".vzb-map-background", ".vzb-map-foreground").getMap();
    this.topojsonMap = this.map.topojsonMap;
    return this.map.initMap();
  }

  getDeck() {
    this.__viewState = {
      longitude: 0,
      latitude: 0,
      pitch: 0,
      zoom: 0,
      transitionDuration: 1
    };

    return new Deck({
      // The HTML container to render into
      parent: this.DOM.mapForeground.node(),
      views: new MapView({
        id: 'map', 
        altitude: 1,
        orthographic: true
      }),
      viewState: this.__viewState,
      getCursor: ({isDragging, isHovering}) => 
        isDragging ? 'grabbing' : isHovering ? 'pointer' : 'default'
      ,
      onViewStateChange: e => {
        //console.log("onviewstatechange", e);
        this.__viewState = e.viewState;
        this.deckMap.setProps({ viewState: this.__viewState });
      },
      // onResize: ({ width, height }) => {
      //   console.log("onresize", this, width, height);
      //   const targetDelta = [(this.__viewState.width - width) * 0.5, (this.__viewState.height - height) * 0.5, 0];
      //   this.deckMap.setProps({ viewState: { ...this.__viewState, target: this.__viewState.target.map((v, i) => v - targetDelta[i])}});
      // }
    });
  }

  getProps() {
    return {
      getMapFillColor: (d, { target }) => {
        if (!d) return;
        const c = this.map.getMapColor(d[KEY]);
        const color = c ? d3.color(c).formatRgb().slice(4, -1).split(",").map(v=>+v) : [0, 0, 0];
        target[0] = color[0];
        target[1] = color[1];
        target[2] = color[2];
        target[3] = c ? this.map.getOpacity(d[KEY]) * 255 : 0;
        return target;
      },
      getMapLineColor: (d, { target }) => {
        if (!d) return;
        const c = this.map.getStrokeColor(d[KEY]);
        const color = c ? d3.color(c).formatRgb().slice(4, -1).split(",").map(v=>+v) : [0, 0, 0];
        target[0] = color[0];
        target[1] = color[1];
        target[2] = color[2];
        target[3] = c ? 255 : 0;
        return target;
      },
      onMapHover: ({ object: d }) => {
        //console.log("onhover", d, this.activeObject);
        //zero opacity for non-selected markers
        if (d && this.map.getOpacity(d[KEY]) == 0) return;
        const invalidate = d?.[KEY] !== this.activeObject?.[KEY]
        //this.activeObject = d;
        if (invalidate) {
          //setTimeout(() => {
          //console.log("invalidate", d, this.activeObject);
          if (!d) {
            runInAction(() => {
              this.MDL.highlighted.data.filter.clear();
              //console.log("clear highlighted");
            })        
          } else {
            runInAction(() => {
              this.MDL.highlighted.data.filter.clear();
            })        
            runInAction(() => {
              this.MDL.highlighted.data.filter.set({[KEY]: d[KEY]});
              //console.log("highlight", d[KEY]);
            })        
          }
          //}, 0);
        }
      },
      onMapClick: ({ object: d }) => {
        if (!d) return;
        if (d && this.map.getOpacity(d[KEY]) == 0) return;
        let dataKey = {[KEY]: d?.[KEY]}
        console.log("click pretoggle", d, dataKey);
        runInAction(() => {
          this.model.encoding.selected.data.filter.toggle(dataKey);
          console.log("click toggle", dataKey);
        })      
        this.deckMap.setProps({layers: this.getMapLayers()})
      },
      getFillColor: (d, { target }) => {
        if (!d) return;
        const c = d3.color(this.cScale(d.color)).formatRgb().slice(4, -1).split(",").map(v=>+v);
        target[0] = c[0];
        target[1] = c[1];
        target[2] = c[2];
        target[3] = this.getOpacity(d) * 255;
        return target;
      },
      getLineColor: (d, { target }) => {
        if (!d) return;
        target[0] = 0x3;
        target[1] = 0x3;
        target[2] = 0x3;
        target[3] = this.getOpacity(d) * 255;
        return target;
      },
      getPosition: (d) => {
        if (!d) return;
        const centroid = this.map.centroid(d[KEY]);
        return centroid;
      },
      getRadius: (d) => {
        if (!d) return;
        return d[R];
      },
      getDragged: (d) => {
        if (!d) return;
        const key = d[TRAIL_KEY] || d[KEY];
        return this.labelDragged[key];
      },
      onHover: ({ object: d }) => {
        //console.log("onhover", d, this.activeObject);
        //zero opacity for non-selected markers
        if (d && this.getOpacity(d) == 0) return;
        const invalidate = d?.[KEY] !== this.activeObject?.[KEY]
        //this.activeObject = d;
        if (invalidate) {
          //setTimeout(() => {
          //console.log("invalidate", d, this.activeObject);
          if (!d) {
            runInAction(() => {
              this.MDL.highlighted.data.filter.clear();
              //console.log("clear highlighted");
            })        
          } else {
            runInAction(() => {
              this.MDL.highlighted.data.filter.clear();
            })        
            runInAction(() => {
              this.MDL.highlighted.data.filter.set({[KEY]: d[KEY]});
              //console.log("highlight", d[KEY]);
            })        
          }
          //}, 0);
        }
      },
      onClick: ({ object:d, index }) => {
        //console.log("onclick", d, this.activeObject);  
        if (!d) return;
        //zero opacity for non-selected markers
        if (this.getOpacity(d) == 0) return;

        let dataKey = {[KEY]: d[KEY]}
        console.log("click pretoggle", d, dataKey);
        if (d[TRAIL_KEY]) {
          const nextIndex = index + 1;
          if (this.__data[nextIndex]?.[TRAIL_KEY] == d[TRAIL_KEY]) {
            return;
          } else {
            dataKey = {[KEY]: d[TRAIL_KEY]}
          }
        }
        //const invalidate = d?.[KEY] !== this.activeObject?.[KEY]
        runInAction(() => {
          this.MDL.selected.data.filter.toggle(dataKey);
          console.log("click toggle", dataKey);
        })      
        //this.activeObject = d;
        //if (invalidate) {
          //setTimeout(() => {
          //console.log("invalidate", d, this.activeObject);  
        this.deckMap.setProps({layers: this.getMapLayers()})
          //}, 0);
        //}
      },
      getLabelPositionZ: (d, { index }) => {
        if (!d) return;
        const centroid = this.map.centroid(d[KEY]);
        return centroid.concat(this.labelZScale(index));
      },
      getLabelText: (d) => {
        if (!d) return;
        return this.__labelWithoutFrame(d);
      },
      getLabelFontSize: (d) => {
        if (!d) return;
        return this._labels.getFontSize(d.size_label);
      },
      getTooltipPixelOffset: (d) => {
        if (!d) return;
        const r = (this.ui.map.showBubbles ? d[R] / Math.sqrt(2) : 0) + 7;
        return [-r, -r];
      },
      getPixelOffset: (d) => {
        if (!d) return;
        const key = d[TRAIL_KEY] || d[KEY];
        const offsetX = this.labelOffset[key] && this.labelOffset[key][0] || 0;
        const offsetY = this.labelOffset[key] && this.labelOffset[key][1] || 0;
        const r = (this.ui.map.showBubbles ? d[R] / Math.sqrt(2) : 0) + 4;
        return [offsetX || -r, offsetY || -r];
      },
      onLabelDragStart: ({ object:d, x, y, coordinate, sourceLayer, viewport }, evt) => {
        console.log("onLabelDragStart", d, x, y, coordinate, viewport, sourceLayer)
        if (!d) return;
        this.__labelDragging = true;
        const key = d[TRAIL_KEY] || d[KEY];
        if (!this.labelOffset[key]) {
          const r = (this.ui.map.showBubbles ? d[R] / Math.sqrt(2) : 0) + 4;
          this.labelOffset[key] = [-r, -r];
        }
  
        //adjust label offset if label with current offset located outside of vieport
        const offset = this.labelOffset[key];
        const pPos = viewport.project(this.props.getPosition(d).slice(0,2));
        const vW = viewport.width;
        const vH = viewport.height;
        const [lW, lH] = sourceLayer.parent.state.labelSize;
        const [lPaddL, lPaddT, lPaddR = lPaddL, lPaddB = lPaddT] = sourceLayer.parent.props.backgroundPadding;
  
        if (!this.labelDragged[key]) {
          this.labelDragged[key] = 1.0;
  
          if(pPos[0] + offset[0] < lW + lPaddL) {
            offset[0] = lW - offset[0];
          }
          if(pPos[1] + offset[1] < lH + lPaddT) {
            offset[1] = lH - offset[1];
          }    
        }
  
        if(pPos[0] + offset[0] < lW + lPaddL) {
          offset[0] = lW + lPaddL - pPos[0];
        } else if(pPos[0] + offset[0] > vW - lPaddR) {
          offset[0] = vW - lPaddR - pPos[0];
        }
        
        if(pPos[1] + offset[1] < lH + lPaddT) {
          offset[1] = lH + lPaddT - pPos[1];
        } else if(pPos[1] + offset[1] > vH - lPaddB) {
          offset[1] = vH - lPaddB - pPos[1];
        }
  
        console.log("offset", offset, "point", pPos, lW, lH, viewport);
        this.dragX0 = this.labelOffset[key][0] - x;
        this.dragY0 = this.labelOffset[key][1] - y;
        //this.deckMap.setProps({layers: this.getMapLayers(undefined, false, 0, false), controller: { dragPan: dragFlag }}); 
        return true;
      },
      onLabelDrag: ({ object:d, x, y, coordinate, sourceLayer, viewport }, evt) => {
        if (!d) return;
        
        this.dragX = this.dragX0 + x;
        this.dragY = this.dragY0 + y;
        const key = d[TRAIL_KEY] || d[KEY];
        this.labelOffset[key][0] = this.dragX;
        this.labelOffset[key][1] = this.dragY;
        const pos = this.props.getPosition(d).slice(0,2);
        //console.log("offset", this.labelOffset[key], "point", sourceLayer.project(pos),  viewport.getBounds(), viewport);
        this.deckMap.setProps({layers: this.getMapLayers(),}); //views: this.getViews({ dragPan: dragFlag }),}); 
        return true;
      },
      onLabelDragEnd: () => {
        //if (!d) return;
        this.__labelDragging = false;  
        return true;
      },
      onLabelClick: ({ object:d, layer, sourceLayer }) => {
        if (!d) return;
        if (sourceLayer.id !== "labelTextLayer-close") return;
        
        const dataKey = {[KEY]: d[TRAIL_KEY] || d[KEY]}
        console.log("click pretoggle", d, dataKey);
        runInAction(() => {
          this.MDL.selected.data.filter.toggle(dataKey);
          console.log("click toggle", dataKey);
        })
        layer.setState({closeData: []});
        
        this.deckMap.setProps({layers: this.getMapLayers()});
      },
      onLabelHover: ({ object:d, layer, x, y }) => {
        if (d && this.__selectedKeys.at(-1) !== d[KEY]) {
          const index = this.__selectedKeys.indexOf(d[KEY]);
          this.__selectedKeys.push(this.__selectedKeys.splice(index, 1)[0]);
          const data = this.__labelData.splice(index, 1);
          this.__labelData = [...this.__labelData, ...data];
          layer.setState({ closeData: [layer.state.closeData[0]]});
          layer.state.closeData[0].dataIndex = this.__selectedKeys.length - 1;
          this.deckMap.setProps({layers: this.getMapLayers()});
        }
      }
    }
  }

  getMapLayers(data = this.__data, t = false, duration = 0) {
    return [
      this.ui.map.showAreas && new GeoJsonLayer({
        parameters: {depthTest: false},
        id: "geoJsonLayer",
        data: this.__filteredFeatures,
        getFillColor: this.props.getMapFillColor,
        getLineColor: this.props.getMapLineColor,
        getLineWidth: 0.5,
        lineWidthUnits: "pixels",
        pickable: !this.ui.map.showBubbles,
        onHover: this.props.onMapHover,
        onClick: this.props.onMapClick,
        updateTriggers: {
          getFillColor: [this.activeObject, this.opacityUpdateTrigger, this.redrawUpdateTrigger, this.__labelData],
          //getLineColor: [activeObject],
          //getPosition: [activeObject]
        },
        visible: !this.hideAllLayers
      }),
      this.ui.map.showBubbles && new ScatterplotLayer({
        parameters: {depthTest: false},
        id: "scatterPlotLayer",//_"+s,
        data: data,//.slice(0),//.slice(s, s+chunkCount),
        stroked: true,
        getPosition: this.props.getPosition,
        getRadius: this.props.getRadius,
        radiusUnits: 'pixels',
        getFillColor: this.props.getFillColor,
        getLineColor: this.props.getLineColor,
        getLineWidth: 1.0,
        lineWidthUnits: 'pixels',
        padding: [6, 4],
        pickable: true,
        onHover: this.props.onHover,
        onClick: this.props.onClick,
        updateTriggers: {
          getFillColor: [this.activeObject, this.opacityUpdateTrigger],
          getLineColor: [this.activeObject, this.opacityUpdateTrigger],
          getRadius: [this.redrawUpdateTrigger]
        },
        //numInstances: 10,
        transitions: t ? { 
          getRadius: {
            duration,
            onStart: (e) => {
              console.log("start", e);
            },
            onEnd: (e) => {
              console.log("end", e);
            }
          },
          // getFillColor: {
          //   duration,
          // },
          // getLineColor: {
          //   duration,
          // }
        } : null,
        visible: !this.hideAllLayers
      }),
      this.ui.map.showBubbles && new ScatterplotLayer({
        parameters: {depthTest: false},
        id: "activeObjectscatterPlotLayer",//_"+s,
        data: this.activeObjectData,//.slice(0),//.slice(s, s+chunkCount),
        stroked: true,
        getPosition: this.props.getPosition,
        getRadius: this.props.getRadius,
        radiusUnits: 'pixels',
        getFillColor: this.props.getFillColor,
        getLineColor: this.props.getLineColor,
        getLineWidth: 1.0,
        lineWidthUnits: 'pixels',
        pickable: false,
        onHover: this.props.onHover,
        onClick: this.props.onClick,
        //padding: this.activeObject ? [6, 4] : 0,
        updateTriggers: {
          getFillColor: [this.activeObject, this.opacityUpdateTrigger],
          getLineColor: [this.activeObject, this.opacityUpdateTrigger],
          getPosition: [this.activeObject, this.redrawUpdateTrigger]
        },
        //numInstances: 10,
        transitions: t ? { 
          getRadius: {
            duration,
          },
        } : null,
        visible: !this.hideAllLayers && !!this.activeObject,
        //_dataDiff: (newData, oldData) => {
        //  console.log("_datediff", newData, oldData, _updateRanges);
          //return dataDiff ? playing ? _updateRanges : null : null;
        //}
      }),
      new TextLayer({
        id: 'tooltipTextLayer',
        _subLayerProps: {
          background: {
            type: LabelBackgroundLayer,
            cornerRadius: 5,
          },
          characters: {
            type: LabelMultiIconLayer,
            updateTriggers: {
              getPixelOffset: [this.dragX, this.dragY],
              getDragged: [this.dragX0, this.dragY0],
            },   
          }
        },
        data: this.activeObject && this.__tooltipDataFilter() ? this.activeObjectData : null,
        fontSettings: this.ui.labels.removeLabelBox ? {
          sdf: true,
          fontSize: 24
        } : { sdf: false },
        getPosition: this.props.getPosition,
        getPixelOffset: [-5, -5],//this.props.getPixelOffset,
        getText: this.props.getLabelText,
        getColor: [10, 10, 10],
        getSize: this.__defaultFontSize,
        getTextAnchor: 'end',
        getAlignmentBaseline: 'bottom',
        getDragged: this.props.getDragged,
        pickable: false,
        background: !this.ui.labels.removeLabelBox,
        backgroundPadding: [6, 4],
        getBorderWidth: 1,
        characterSet: CHARACTER_SET,
        fontFamily: this.FONT_FAMILY,
        billboard: true,
        outlineColor: [255, 255, 255],
        outlineWidth: this.ui.labels.removeLabelBox ? 4 : 0,
        visible: !this.hideAllLayers,
      }),
      this.ui.labels.enabled && new LabelLayer({
        //parameters: {depthTest: false},
        id: 'labelTextLayer',
        _subLayerProps: {
          background: {
            type: LabelBackgroundLayer,
            cornerRadius: 5,
            getDragged: this.props.getDragged,
            updateTriggers: {
              getDragged: [this.dragX0, this.dragY0],
            },   
          },
          characters: {
            type: LabelMultiIconLayer,
            getDragged: this.props.getDragged,
            updateTriggers: {
              getDragged: [this.dragX0, this.dragY0],
            },   
            padding: [6, 4],
          }
        },
        data: this.__labelData,
        fontSettings: this.ui.labels.removeLabelBox ? {
          sdf: true,
          fontSize: 24,
          buffer: 10
        } : { sdf: false },
        getPosition: this.props.getLabelPositionZ,
        getPixelOffset: this.props.getPixelOffset,
        getLineSourceFillOffset: this.ui.map.showBubbles ? this.props.getRadius : 0,
        getText: this.props.getLabelText,
        getColor: [10, 10, 10],
        getSize: this.__isConstantFontSize ? this.__fontSize : this.props.getLabelFontSize,
        getTextAnchor: 'end',
        getAlignmentBaseline: 'bottom',
        getDragged: this.props.getDragged,
        getPolygonOffset: null,//({layerIndex}) => [0, layerIndex * 100],
        onDragStart: this.props.onLabelDragStart,
        onDrag: this.props.onLabelDrag,
        onDragEnd: this.props.onLabelDragEnd,
        onHover: this.props.onLabelHover,
        onClick: this.props.onLabelClick,
        characterSet: CHARACTER_SET,
        fontFamily: this.FONT_FAMILY,
        pickable: true,
        outlineColor: [255, 255, 255],
        outlineWidth: 4,
        background: !this.ui.labels.removeLabelBox,
        backgroundPadding: [6, 4],
        getBorderWidth: 1,
        billboard: true,
        lineWidthUnits: 'pixels',
        radiusUnits: 'pixels',
        updateTriggers: {
          getPixelOffset: [this.dragX, this.dragY],
          getDragged: [this.dragX0, this.dragY0],
        },
        transitions: t ? {
          getLineSourceFillOffset: {
            duration,
          }
        } : null,
        visible: !this.hideAllLayers,
      }),
    ]
  }

  __tooltipDataFilter() {
    return this.ui.labels.enabled ? !this.activeObject[TRAIL_KEY] && this.__selectedKeys.indexOf(this.activeObject[KEY]) == -1 : true;
  }

}

_VizabiExtApiMap.DEFAULT_UI = {
  "map": {
    "missingDataColor": "none", //"#FDFDFD" or "none" for transparent. "none" makes it faster
    "scale": 1,
    "preserveAspectRatio": true,
    "mapEngine": "mapbox",
    "mapStyle": "mapbox://styles/mapbox/light-v9",
    "showBubbles": true,
    "showAreas": false,
    "showMap": true,
    "offset": {
      top: 0.05,
      right: 0.01,
      bottom: 0.05,
      left: -0.12
    },
    "path": null,
    "bounds": {
      "north": 70,
      "west": 80,
      "south": -50,
      "east": -80
    },
    "projection": "mercator",
    topology: {
      path: "assets/world-50m.json",
      objects: {
        areas: "countries",
        boundaries: "land"
      },
      geoIdProperty: "id",
    }
  }
};

export const VizabiExtApiMap = decorate(_VizabiExtApiMap, {
  "MDL": computed,
  "duration": computed
});

Chart.add("extapimap", VizabiExtApiMap);
