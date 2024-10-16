import { 
  Chart,
  Labels,
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

const {ICON_QUESTION} = Icons;
//const COLOR_BLACKISH = "rgb(51, 51, 51)";
const COLOR_WHITEISH = "rgb(253, 253, 253)";

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
      <div id="vzb-map-background"></div>
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
      type: Labels,
      placeholder: ".vzb-bmc-labels",      
      options: {
        CSS_PREFIX: "vzb-bmc",
        LABELS_CONTAINER_CLASS: "vzb-bmc-labels",
        LINES_CONTAINER_CLASS: "vzb-bmc-lines",
        SUPPRESS_HIGHLIGHT_DURING_PLAY: false
      },
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
  }

  setup() {
    this.DOM = {
      chartSvg: this.element.select("svg"),
      zoomRect: this.element.select(".vzb-bc-zoom-rect")
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

    this._labels = this.findChild({type: "Labels"});

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

    this.element.call(this._createMapDragger());
    this.element.on("mousewheel", zoomOnWheel)
      .on("wheel", zoomOnWheel);

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
      centroid: this.model.encoding.centroid
    };
  }

  draw(){
    this.localise = this.services.locale.auto(this.MDL.frame.interval);

    this.treemenu = this.root.findChild({type: "TreeMenu"});

    // new scales and axes
    this.sScale = this.MDL.size.scale.d3Scale;
    this.cScale = color => color? this.MDL.color.scale.d3Scale(color) : COLOR_WHITEISH;

    this.TIMEDIM = this.MDL.frame.data.concept;
    this.KEYS = this.model.data.space.filter(dim => dim !== this.TIMEDIM);

    if (this._updateLayoutProfile()) return; //return if exists with error

    runInAction(() => {
      this.preload().then(() => {
        if (this.map.inPreload) return;
        this.addReaction(this._updateSize);
        //this.addReaction(this._updateMarkerSizeLimits);
        this.addReaction(this._getDuration);
        this.addReaction(this._drawData);
        this.addReaction(this._mapReady);
        this.addReaction(this._updateMap);
        this.addReaction(this._updateMapColors);
        this.addReaction(this._updateOpacity);
        this.addReaction(this._blinkSuperHighlighted);
        this.addReaction(this._updateUIStrings);
        this.addReaction(this._highlightDataPoints);
        this.addReaction(this._selectDataPoints);
        //this.addReaction(this._redrawData);

        this.addReaction(this._setupCursorMode);
      });
    });
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

  _drawData() {
    this._processFrameData();
    this._createAndDeleteBubbles();
    this._updateMarkerSizeLimits();
    runInAction(() => {
      this._redrawData();
    });
  }

  _redrawData(duration) {
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
    return this.__dataProcessed = this.model.dataArray
      .concat()
      .map(this.getValue)
      //TODO sorting can be done via order encoding
      .sort((a, b) => b.size - a.size);
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

    this.bubbles
      .classed("vzb-super-highlighted", d => superHighlightFilter.has(d));
  }

  _drawForecastOverlay() {
    this.DOM.forecastOverlay.classed("vzb-hidden", 
      !this.MDL.frame.endBeforeForecast || 
      !this.ui.showForecastOverlay || 
      (this.MDL.frame.value <= this.MDL.frame.endBeforeForecast)
    );
  }

  _hideEntities(duration) {
    this.DOM.graph.select("." + this._labels.options.LABELS_CONTAINER_CLASS)
      .transition()
      .duration(duration)
      .style("opacity", 0);
    this.DOM.graph.select("." + this._labels.options.LINES_CONTAINER_CLASS)
      .transition()
      .duration(duration)
      .style("opacity", 0);
    this.DOM.bubbleContainer
      .transition()
      .duration(duration)
      .style("opacity", 0);
  }

  _showEntities(duration) {
    this.DOM.graph.select("." + this._labels.options.LABELS_CONTAINER_CLASS)
      .transition()
      .duration(duration)
      .style("opacity", 1);
    this.DOM.graph.select("." + this._labels.options.LINES_CONTAINER_CLASS)
      .transition()
      .duration(duration)
      .style("opacity", 1);
    this.DOM.bubbleContainer
      .transition()
      .duration(duration)
      .style("opacity", 1);

  }

  mapBoundsChanged() {
    this._redrawData();
    //this.updateMarkerSizeLimits();
    //this.redrawDataPoints(null, true);
    if (!this.ui.map.showBubbles) this.updateLabels(null);
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
    
    if (this.MDL.highlighted.data.filter.has(d) || this.MDL.superHighlighted.data.filter.has(d)) return opacityRegular;
    if (this.MDL.selected.data.filter.has(d)) return opacityRegular;

    if (this.someSelected) return opacitySelectDim;
    if (this.someHighlighted) return opacityHighlightDim;

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
    const svg = this.DOM.chartSvg;
    if (this.ui.cursorMode === "plus") {
      svg.classed("vzb-zoomin", true);
      svg.classed("vzb-zoomout", false);
      svg.classed("vzb-panhand", false);
    } else if (this.ui.cursorMode === "minus") {
      svg.classed("vzb-zoomin", false);
      svg.classed("vzb-zoomout", true);
      svg.classed("vzb-panhand", false);
    } else if (this.ui.cursorMode === "hand") {
      svg.classed("vzb-zoomin", false);
      svg.classed("vzb-zoomout", false);
      svg.classed("vzb-panhand", true);
    } else {
      svg.classed("vzb-zoomin", false);
      svg.classed("vzb-zoomout", false);
      svg.classed("vzb-panhand", false);
    }
  }

  _createMapDragger() {
    const _this = this;
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
          _this.dragAction = "panning";
          _this._hideEntities();
          _this.map.panStarted();
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
        case "panning": {
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
          _this.map.panFinished();
          _this._showEntities(300);
          _this.DOM.chartSvg.classed("vzb-zooming", false);
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
    this.map = new MapEngine(this, "#vzb-map-background").getMap();
    return this.map.initMap();
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
  "MDL": computed
});

Chart.add("extapimap", VizabiExtApiMap);
