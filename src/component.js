import { 
  BaseComponent,
  Labels,
  Utils,
  LegacyUtils as utils,
  Icons,
  DynamicBackground
} from "VizabiSharedComponents";
import { runInAction, decorate, computed} from "mobx";

import MapEngine from "./map";
// import Selectlist from 'extapimap-selectlist';

const {ICON_WARN, ICON_QUESTION} = Icons;
const COLOR_BLACKISH = "rgb(51, 51, 51)";
const COLOR_WHITEISH = "rgb(253, 253, 253)";

const PROFILE_CONSTANTS = {
  SMALL: {
    margin: { top: 10, right: 10, left: 10, bottom: 0 },
    infoElHeight: 16,
    minRadiusPx: 0.5,
    maxRadiusEm: 0.05
},
  MEDIUM: {
    margin: { top: 20, right: 20, left: 20, bottom: 30 },
    infoElHeight: 20,
    minRadiusPx: 1,
    maxRadiusEm: 0.05
},
  LARGE: {
    margin: { top: 30, right: 30, left: 30, bottom: 35 },
    infoElHeight: 22,
    minRadiusPx: 1,
    maxRadiusEm: 0.05
  }
};

const PROFILE_CONSTANTS_FOR_PROJECTOR = {
  MEDIUM: {
    infoElHeight: 26
  },
  LARGE: {
    infoElHeight: 32
  }
};

//BUBBLE MAP CHART COMPONENT
class _VizabiExtApiMap extends BaseComponent {

  constructor(config) {

    config.template = `
      <div id="vzb-map-background"></div>
      <svg class="vzb-extapimap-svg vzb-export">
          <g class="vzb-bmc-map-background"></g>
          <g class="vzb-bmc-graph">
              <g class="vzb-bmc-year"></g>

              <g class="vzb-bmc-lines"></g>
              <g class="vzb-bmc-bubbles"></g>

              <g class="vzb-bmc-axis-y-title">
                  <text></text>
              </g>

              <g class="vzb-bmc-axis-c-title">
                  <text></text>
              </g>

              <g class="vzb-bmc-axis-y-info vzb-noexport">
              </g>

              <g class="vzb-bmc-axis-c-info vzb-noexport">
              </g>

              <g class="vzb-data-warning vzb-noexport">
                  <svg></svg>
                  <text></text>
              </g>
              <g class="vzb-bmc-labels"></g>

              <rect class="vzb-bc-zoom-rect"></rect>
          </g>
      </svg>
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
      type: DynamicBackground,
      placeholder: ".vzb-bmc-year"
    }];

    super(config);
  }

  setup() {
    this.DOM = {
      chartSvg: this.element.select("svg"),
      zoomRect: this.element.select(".vzb-bc-zoom-rect")
    }
    this.DOM.chartSvg.select(".vzb-bmc-graph").call(graph => 
      Object.assign(this.DOM, {
        graph,
        bubbleContainerCrop: graph.select(".vzb-bmc-bubbles-crop"),
        bubbleContainer: graph.select(".vzb-bmc-bubbles"),
        labelListContainer: graph.select(".vzb-bmc-bubble-labels"),
        dataWarning: graph.select(".vzb-data-warning"),
        yTitle: graph.select(".vzb-bmc-axis-y-title"),
        cTitle: graph.select(".vzb-bmc-axis-c-title"),
        yInfo: graph.select(".vzb-bmc-axis-y-info"),
        cInfo: graph.select(".vzb-bmc-axis-c-info"),
        year: graph.select(".vzb-bmc-year")
      })
    );

    this.bubblesDrawing = null;

    this.isMobile = utils.isMobileOrTablet();

    this._year = this.findChild({type: "DynamicBackground"});
    this._year.setConditions({ xAlign: "left", yAlign: "bottom" });

    this._labels = this.findChild({type: "Labels"});

    this.wScale = d3.scaleLinear()
      .domain(this.ui.datawarning.doubtDomain)
      .range(this.ui.datawarning.doubtRange);

    const zoomOnWheel = function() {
      if (_this.ui.zoomOnScrolling) {
        const mouse = d3.mouse(_this.DOM.graph.node());
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

    this.element.call(this._createMapDragger());
    this.element.on("mousewheel", zoomOnWheel)
      .on("wheel", zoomOnWheel);

    const _this = this;
    d3.select("body")
      .on("keydown", () => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (d3.event.metaKey || d3.event.ctrlKey) {
          _this.DOM.chartSvg.classed("vzb-zoomin", true);
          //_this.ui.set("cursorMode", "plus", false, false);
        }
      })
      .on("keyup", () => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (!d3.event.metaKey && !d3.event.ctrlKey) {
          _this.DOM.chartSvg.classed("vzb-zoomin", false);
          //_this.ui.set("cursorMode", "arrow", false, false);
        }
      })
      //this is for the case when user would press ctrl and move away from the browser tab or window
      //keyup event would happen somewhere else and won't be captured, so zoomin class would get stuck
      .on("mouseenter", () => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (!d3.event.metaKey && !d3.event.ctrlKey) {
          _this.ui.cursorMode = "arrow";
        }
      });

  }

  get MDL(){
    return {
      frame: this.model.encoding.get("frame"),
      selected: this.model.encoding.get("selected"),
      highlighted: this.model.encoding.get("highlighted"),
      size: this.model.encoding.get("size"),
      color: this.model.encoding.get("color"),
      mapColor: this.model.encoding.get("color_map"),
      label: this.model.encoding.get("label"),
      centroid: this.model.encoding.get("centroid")
    };
  }

  draw(){
    this.localise = this.services.locale.auto();

    this.treemenu = this.root.findChild({type: "TreeMenu"});

    // new scales and axes
    this.sScale = this.MDL.size.scale.d3Scale;
    this.cScale = color => color? this.MDL.color.scale.d3Scale(color) : COLOR_WHITEISH;
    this.mcScale = color => color? this.MDL.mapColor.scale.d3Scale(color) : COLOR_WHITEISH;

    this.TIMEDIM = this.MDL.frame.data.concept;
    this.KEYS = this.model.data.space.filter(dim => dim !== this.TIMEDIM);

    if (this._updateLayoutProfile()) return; //return if exists with error

    runInAction(() => {
      this.preload().then(() => {
        this.addReaction(this._updateSize);
        this.addReaction(this._updateMarkerSizeLimits);
        this.addReaction(this._getDuration);
        this.addReaction(this._drawData);
        this.addReaction(this._updateOpacity);
        this.addReaction(this._updateDoubtOpacity);
        runInAction(() => {
          this.map.ready();
        });

        this.addReaction(this._updateMap);
        this.addReaction(this._updateMapColors);
        this.addReaction(this._updateUIStrings);
        //this.addReaction(this._redrawData);

        this.addReaction(this._setupCursorMode);
      });
    });
  }

  _updateLayoutProfile(){
    this.services.layout.size;

    this.profileConstants = this.services.layout.getProfileConstants(PROFILE_CONSTANTS, PROFILE_CONSTANTS_FOR_PROJECTOR);
    const margin = this.profileConstants.margin;

    this.height = (this.element.node().clientHeight) || 0;
    this.chartHeight = this.height - margin.top - margin.bottom;
    this.width = (this.element.node().clientWidth) || 0;
    this.chartWidth = this.width - margin.left - margin.right;
    if (!this.height || !this.width) return utils.warn("Chart _updateProfile() abort: container is too little or has display:none");

  }

  _drawData() {
    this._processFrameData();
    this._createAndDeleteBubbles();
    runInAction(() => {
      this._redrawData();
    })
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

      d.hidden = (!d.size && d.size !== 0) || d.centroid == null || !d.center;

      if(d.center) {
        view
          .attr("cx", d.center[0])
          .attr("cy", d.center[1]);
      }
 
      view
        .classed("vzb-hidden", d.hidden)
        
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
        scaledC0: this.cScale(d.color)
      };

      this._labels.updateLabel(d, cache, d.center[0] / this.width, d.center[1] / this.height, d.size, d.color, this.__labelWithoutFrame(d), valueLST, duration, showhide);
    }
  }

  _getPosition(d) {
    if (d.lat && d.lng) {
      return this.map.geo2Point(d.lat, d.lng);
    }
    if (d.centroid) {
      return this.map.centroid(d.centroid);
    }
    utils.warn("_getPosition(): was unable to resolve bubble positions either via lat/long or centroid")
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
      .data(this.__dataProcessed, d => d[Symbol.for("key")]);

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
      .on("mouseover", this._interact().mouseover)
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
      mousedown(d) {
        if (_this.ui.cursorMode === "arrow") d3.event.stopPropagation();
      },
      mouseover(d) {
        if (_this.MDL.frame.dragging) return;

        _this.hovered = d;
        _this.MDL.highlighted.data.filter.set(d);
        //put the exact value in the size title
        //this.updateTitleNumbers();
        //_this.fitSizeOfTitles();
       
        // if not selected, show tooltip
        if (!_this.MDL.selected.data.filter.has(d)) _this._setTooltip(d);
      },
      mouseout(d) {
        if (_this.MDL.frame.dragging) return;

        _this.hovered = null;
        _this.MDL.highlighted.data.filter.delete(d);
        //_this.updateTitleNumbers();
        //_this.fitSizeOfTitles();

        _this._setTooltip();
        //_this._labels.clearTooltip();
      },
      click(d) {
        _this.MDL.highlighted.data.filter.delete(d);
        _this._setTooltip();
        //_this._labels.clearTooltip();
        _this.MDL.selected.data.filter.toggle(d);
        _this._updateLabel(d);
        //_this.selectToggleMarker(d);
      },
      tap(d) {
        _this._setTooltip();
        _this.MDL.selected.data.filter.toggle(d);
        _this._updateLabel(d);
        //_this.selectToggleMarker(d);
        d3.event.stopPropagation();
      }
    };
  }

  _mapInteract() {
    const _this = this;
    const d = {};
    return {
      _mouseover(key, i) {
        if (utils.isTouchDevice()
          || _this.ui.cursorMode !== "arrow"
          || _this.ui.map.showBubbles
          || !_this.map.keys[key]
        ) return;
        d[_this.KEY] = _this.map.keys[key];
        _this._interact()._mouseover(d);
      },
      _mouseout(key, i) {
        if (utils.isTouchDevice()
          || _this.ui.cursorMode !== "arrow"
          || _this.ui.map.showBubbles
          || !_this.map.keys[key]
        ) return;
        d[_this.KEY] = _this.map.keys[key];
        _this._interact()._mouseout(d);
      },
      _click(key, i) {
        if (utils.isTouchDevice()
          || _this.ui.cursorMode !== "arrow"
          || _this.ui.map.showBubbles
          || !_this.map.keys[key]
        ) return;
        d[_this.KEY] = _this.map.keys[key];
        _this._interact()._click(d);
      }
    };
  }


  repositionElements() {
    const margin = this.profileConstants.margin;
    const infoElHeight = this.profileConstants.infoElHeight;
    const isRTL = this.services.locale.isRTL();

    const graphWidth = this.width - margin.left - margin.right;

    this.DOM.graph
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    this._year.setConditions({
      widthRatio: 2 / 10
    });
    this._year.resize(this.width, this.height - margin.top);

    this.DOM.yTitle
      .style("font-size", infoElHeight)
      .attr("transform", "translate(" + (isRTL ? this.graphWidth : 0) + "," + margin.top + ")");

    const yTitleBB = this.DOM.yTitle.select("text").node().getBBox();

    //hide the second line about color in large profile or when color is constant
    this.DOM.cTitle.attr("transform", "translate(" + (isRTL ? this.width : 0) + "," + (margin.top + yTitleBB.height) + ")")
      .classed("vzb-hidden", this.services.layout.profile === "LARGE" || this.MDL.color.data.isConstant());

    const warnBB = this.DOM.dataWarning.select("text").node().getBBox();
    this.DOM.dataWarning.select("svg")
      .attr("width", warnBB.height * 0.75)
      .attr("height", warnBB.height * 0.75)
      .attr("x", -warnBB.width - warnBB.height * 1.2)
      .attr("y", -warnBB.height * 0.65);

    this.DOM.dataWarning
      .attr("transform", "translate(" + (graphWidth) + "," + (this.height - margin.bottom - warnBB.height * 0.5) + ")")
      .select("text");

    if (this.DOM.yInfo.select("svg").node()) {
      const titleBBox = this.DOM.yTitle.node().getBBox();
      const t = utils.transform(this.DOM.yTitle.node());
      const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);

      this.DOM.yInfo.select("svg")
        .attr("width", infoElHeight)
        .attr("height", infoElHeight);
      this.DOM.yInfo.attr("transform", "translate("
        + hTranslate + ","
        + (t.translateY - infoElHeight * 0.8) + ")");
    }

    this.DOM.cInfo.classed("vzb-hidden", this.DOM.cTitle.classed("vzb-hidden"));

    if (!this.DOM.cInfo.classed("vzb-hidden") && this.DOM.cInfo.select("svg").node()) {
      const titleBBox = this.DOM.cTitle.node().getBBox();
      const t = utils.transform(this.DOM.cTitle.node());
      const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);

      this.DOM.cInfo.select("svg")
        .attr("width", infoElHeight)
        .attr("height", infoElHeight);
      this.DOM.cInfo.attr("transform", "translate("
        + hTranslate + ","
        + (t.translateY - infoElHeight * 0.8) + ")");
    }
  }

  _updateMapColors() {
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
      minRadiusPx,
    } = this.profileConstants;

    const extent = this.MDL.size.extent || [0, 1];

    let minRadius = minRadiusPx;
    let maxRadius = this.maxRadiusPx;

    let minArea = utils.radiusToArea(Math.max(maxRadius * extent[0], minRadius));
    let maxArea = utils.radiusToArea(Math.max(maxRadius * extent[1], minRadius));

    let range = minArea === maxArea ? [minArea, maxArea] :
      d3.range(minArea, maxArea, (maxArea - minArea) / this.sScale.domain().length).concat(maxArea);

    this.sScale.range(range);
  }

  _updateUIStrings() {
    const _this = this;

    const isRTL = this.services.locale.isRTL();

    const conceptPropsS = _this.MDL.size.data.conceptProps;
    const conceptPropsC = _this.MDL.color.data.conceptProps;

    this.strings = {
      title: {
        S: conceptPropsS.name,
        C: conceptPropsC.name
      }
    };

    this.DOM.yTitle
      .classed("vzb-disabled", this.treemenu.state.ownReadiness !== Utils.STATUS.READY)
      .select("text").text(this.localise("buttons/size") + ": " + this.strings.title.S)
      .on("click", () => {
        this.treemenu
          .encoding("size")
          .alignX(this.services.locale.isRTL() ? "right" : "left")
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
          .alignX(this.services.locale.isRTL() ? "right" : "left")
          .alignY("top")
          .updateView()
          .toggle();
      });

    utils.setIcon(this.DOM.dataWarning, ICON_WARN).select("svg").attr("width", "0px").attr("height", "0px");
    this.DOM.dataWarning.append("text")
      .attr("text-anchor", "end")
      .text(this.localise("hints/dataWarning"));

    this.DOM.dataWarning
      .on("click", () => {
        _this.root.findChild({name: "datawarning"}).toggle();
      })
      .on("mouseover", () => {
        _this._updateDoubtOpacity(1);
      })
      .on("mouseout", () => {
        _this._updateDoubtOpacity();
      });

    const toolRect = _this.root.element.node().getBoundingClientRect();
    const chartRect = _this.element.node().getBoundingClientRect();

    this._drawInfoEl(this.DOM.yInfo, this.DOM.yTitle, this.MDL.size, {x: chartRect.left - toolRect.left});
    this._drawInfoEl(this.DOM.cInfo, this.DOM.cTitle, this.MDL.color);
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
        !conceptProps.description && !conceptProps.sourceLink || titleElement.classed("vzb-hidden")
      );
  }

  _updateSize() {
    this.services.layout.size;

    const {
      minRadiusPx,
      maxRadiusEm,
      margin
    } = this.profileConstants;

    this.maxRadiusPx = Math.max(
      minRadiusPx,
      maxRadiusEm * utils.hypotenuse(this.width, this.height)
    );

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

      _this.DOM.yTitle.select("text")
        .text(_this.localise("buttons/size") + ": " + formatterS(valueS) + " " + unitS);

      _this.DOM.cTitle.select("text")
        .text(_this.localise("buttons/color") + ": " +
          (valueC || valueC === 0 ? formatterC(valueC) + " " + unitC : _this.localise("hints/nodata")));

      this.DOM.yInfo.classed("vzb-hidden", true);
      this.DOM.cInfo.classed("vzb-hidden", true);
    } else {
      this.DOM.yTitle.select("text")
        .text(this.localise("buttons/size") + ": " + this.strings.title.S);
      this.DOM.cTitle.select("text")
        .text(this.localise("buttons/color") + ": " + this.strings.title.C);

      this.DOM.yInfo.classed("vzb-hidden", false);
      this.DOM.cInfo.classed("vzb-hidden", this.DOM.cTitle.classed("vzb-hidden"));
    }
  }

  fitSizeOfTitles() {
    // reset font sizes first to make the measurement consistent
    const yTitleText = this.DOM.yTitle.select("text");
    yTitleText.style("font-size", null);

    const cTitleText = this.DOM.cTitle.select("text");
    cTitleText.style("font-size", null);

    const yTitleBB = yTitleText.node().getBBox();
    const cTitleBB = this.DOM.cTitle.classed("vzb-hidden") ? yTitleBB : cTitleText.node().getBBox();

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

  }

  _updateDataWarning(opacity) {
    this.DOM.dataWarning.style("opacity",
      1 || opacity || (
        !this.MDL.selected.markers.size ?
          this.wScale(this.MDL.frame.value.getUTCFullYear()) :
          1
      )
    );
  }

  _getDuration() {
    //smooth animation is needed when playing, except for the case when time jumps from end to start
    if(!this.MDL.frame) return 0;
    this.frameValue_1 = this.frameValue;
    this.frameValue = this.MDL.frame.value;
    return this.__duration = this.MDL.frame.playing && (this.frameValue - this.frameValue_1 > 0) ? this.MDL.frame.speed : 0;

    //this.year.setText(this.model.time.formatDate(this.time), this.duration);
    //this._updateForecastOverlay();

    //possibly update the exact value in size title
    //this.updateTitleNumbers();
  }

  _updateOpacity() {
    const _this = this;
    this.MDL.frame.value; //listen

    const {
      opacityHighlightDim,
      opacitySelectDim,
      opacityRegular,
    } = this.ui;

    const _highlighted = this.MDL.highlighted.data.filter;
    const _selected = this.MDL.selected.data.filter;
    
    const someHighlighted = _highlighted.any();
    const someSelected = _selected.any();

    this.bubbles
      .style("opacity", d => {
        if (_highlighted.has(d)) return opacityRegular;
        if (_selected.has(d)) return opacityRegular;

        if (someSelected) return opacitySelectDim;
        if (someHighlighted) return opacityHighlightDim;

        return opacityRegular;
      });
  }

  _updateDoubtOpacity(opacity) {
    if (opacity == null) opacity = this.wScale(+this.MDL.frame.value.getUTCFullYear());
    if (this.MDL.selected.data.filter.any()) opacity = 1;
    this.DOM.dataWarning.style("opacity", opacity);
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
    //this.updateLabels(null);
  }

  updateOpacity() {
    const _this = this;
    /*
     this.entityBubbles.classed("vzb-selected", function (d) {
     return _this.model.marker.isSelected(d);
     });
     */
    this.map.updateOpacity();
    this.entityBubbles.style("opacity", d => _this.getOpacity(d));

    this.entityBubbles.classed("vzb-selected", d => _this.model.marker.isSelected(d));

    const nonSelectedOpacityZero = _this.model.marker.opacitySelectDim < 0.01;

    // when pointer events need update...
    if (nonSelectedOpacityZero !== this.nonSelectedOpacityZero) {
      this.entityBubbles.style("pointer-events", d => (!_this.someSelected || !nonSelectedOpacityZero || _this.model.marker.isSelected(d)) ?
        "visible" : "none");
    }

    this.nonSelectedOpacityZero = _this.model.marker.opacitySelectDim < 0.01;
  }

  getMapOpacity(key) {
    if (this.ui.map.showBubbles) {
      return this.ui.opacitySelectDim;
    }
    const d = {};
    d[this.KEY] = key;
    return this.getOpacity(d);
  }

  getOpacity(d) {

    if (this.someHighlighted) {
      //highlight or non-highlight
      if (this.MDL.highlighted.data.filter.has(d)) return this.ui.opacityRegular;
    }

    if (this.someSelected) {
      //selected or non-selected
      return this.MDL.selected.data.filter.has(d) ? this.ui.opacityRegular : this.ui.opacitySelectDim;
    }

    if (this.someHighlighted) return this.ui.opacitySelectDim;

    return this.ui.opacityRegular;
  }

  _setTooltip(d) {
    if (d) {
      const labelValues = {};
      const tooltipCache = {};
      const cLoc = d.cLoc ? d.cLoc : this._getPosition(d);
      const mouse = d3.mouse(this.DOM.graph.node()).map(d => parseInt(d));
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
    return this.KEYS.map(dim => this.localise(d.label[dim])).join(' ');
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
      .on("start", (d, i) => {
        if (
          ((d3.event.sourceEvent.metaKey || d3.event.sourceEvent.ctrlKey) && _this.ui.cursorMode == "arrow") ||
          _this.ui.cursorMode == "plus"

        ) {
          _this.dragAction = "zooming";
          _this.zooming = true;
          const mouse = d3.mouse(_this.DOM.graph.node());
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
      .on("drag", (d, i) => {
        switch (_this.dragAction) {
          case "zooming":
            const mouse = d3.mouse(_this.DOM.graph.node());
            _this.DOM.zoomRect
              .attr("x", Math.min(mouse[0], _this.origin.x))
              .attr("y", Math.min(mouse[1], _this.origin.y))
              .attr("width", Math.abs(mouse[0] - _this.origin.x))
              .attr("height", Math.abs(mouse[1] - _this.origin.y));
            break;
          case "panning":
            _this.map.moveOver(d3.event.dx, d3.event.dy);
            break;
        }
      })
      .on("end", (d, i) => {
        switch (_this.dragAction) {
          case "zooming":
            _this.DOM.zoomRect
              .attr("width", 0)
              .attr("height", 0)
              .classed("vzb-invisible", true);
            if (_this.zooming) {
              const mouse = d3.mouse(_this.DOM.graph.node());
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
            _this.DOM.chartSvg.classed("vzb-zooming", false);
            break;
        }
        if (_this.ui.cursorMode == "minus") {
          const mouse = d3.mouse(_this.DOM.graph.node());
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
  }

  preload() {
    return this._initMap();
  }

  _initMap() {
    this.map = new MapEngine(this, "#vzb-map-background").getMap();
    return this.map.initMap();
  }

}

_VizabiExtApiMap.DEFAULT_UI = {
  "datawarning": {
    "doubtDomain": [1993, 2015],
    "doubtRange": [0, 0]
  },
  "map": {
    "scale": 1,
    "preserveAspectRatio": true,
    "mapEngine": "mapbox",
    "mapStyle": "mapbox://styles/mapbox/light-v9",
    "showBubbles": true,
    "showAreas": false,
    "showMap": true,
    "offset": {
      "top": 0.05,
      "bottom": -0.12,
      "left": 0,
      "right": 0
    },
    "path": null,
    "bounds": {
      "north": 59.48,
      "west": 17.72,
      "south": 59.21,
      "east": 18.32
    },
    "projection": "mercator",
    "topology": {
      "path": "assets/sodertorn-basomr2010.json",
      "objects": {
        "geo": "c1e171fae817c0bfc26dc7df82219e08",
        "boundaries": "c1e171fae817c0bfc26dc7df82219e08"
      },
      "geoIdProperty": "BASKOD2010"
    }
  }
}

export const VizabiExtApiMap = decorate(_VizabiExtApiMap, {
  "MDL": computed
});










const _OldVizabiExtApiMap = {
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
      "change:marker.select": function(evt) {
        if (!_this._readyOnce) return;
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
        const svg = _this.chartSvg;
        if (_this.ui.cursorMode === "plus") {
          svg.classed("vzb-zoomin", true);
          svg.classed("vzb-zoomout", false);
          svg.classed("vzb-panhand", false);
        } else if (_this.ui.cursorMode === "minus") {
          svg.classed("vzb-zoomin", false);
          svg.classed("vzb-zoomout", true);
          svg.classed("vzb-panhand", false);
        } else if (_this.ui.cursorMode === "hand") {
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
  },


  /**
   * DOM is ready
   */
  readyOnce() {
    this.element = d3.select(this.element);

    this.graph = this.element.select(".vzb-bmc-graph");

    this.chartSvg = this.element.select("svg");
    this.bubbleContainerCrop = this.graph.select(".vzb-bmc-bubbles-crop");
    this.bubbleContainer = this.graph.select(".vzb-bmc-bubbles");
    this.labelListContainer = this.graph.select(".vzb-bmc-bubble-labels");
    this.dataWarningEl = this.graph.select(".vzb-data-warning");
    this.zoomRect = this.element.select(".vzb-bc-zoom-rect");
    this.DOM.yTitle = this.graph.select(".vzb-bmc-axis-y-title");
    this.DOM.cTitle = this.graph.select(".vzb-bmc-axis-c-title");
    this.DOM.yInfo = this.graph.select(".vzb-bmc-axis-y-info");
    this.DOM.cInfo = this.graph.select(".vzb-bmc-axis-c-info");

    this.entityBubbles = null;

    // year background
    this.DOM.year = this.graph.select(".vzb-bmc-year");
    this.year = new DynamicBackground(this.DOM.year);
    this.year.setConditions({ xAlign: "left", yAlign: "bottom" });

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
      .domain(this.ui.datawarning.doubtDomain)
      .range(this.ui.datawarning.doubtRange);

    this._labels.readyOnce();

    const mapDragger = d3.drag()
      .on("start", (d, i) => {
        if (
          ((d3.event.sourceEvent.metaKey || d3.event.sourceEvent.ctrlKey) && _this.ui.cursorMode == "arrow") ||
          _this.ui.cursorMode == "plus"

        ) {
          _this.dragAction = "zooming";
          _this.zooming = true;
          const mouse = d3.mouse(this.graph.node());
          _this.origin = {
            x: mouse[0],
            y: mouse[1]
          };
          _this.zoomRect.classed("vzb-invisible", false);
        } else if (
          _this.ui.cursorMode == "hand" ||
          (_this.ui.panWithArrow && _this.ui.cursorMode === "arrow")
        ) {
          _this.dragAction = "panning";
          _this._hideEntities();
          _this.map.panStarted();
          _this.chartSvg.classed("vzb-zooming", true);
        }
      })
      .on("drag", (d, i) => {
        switch (_this.dragAction) {
          case "zooming":
            const mouse = d3.mouse(this.graph.node());
            _this.zoomRect
              .attr("x", Math.min(mouse[0], _this.origin.x))
              .attr("y", Math.min(mouse[1], _this.origin.y))
              .attr("width", Math.abs(mouse[0] - _this.origin.x))
              .attr("height", Math.abs(mouse[1] - _this.origin.y));
            break;
          case "panning":
            _this.map.moveOver(d3.event.dx, d3.event.dy);
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
              const mouse = d3.mouse(this.graph.node());
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
        if (_this.ui.cursorMode == "minus") {
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
      if (_this.ui.zoomOnScrolling) {
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
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (d3.event.metaKey || d3.event.ctrlKey) {
          _this.element.select("svg").classed("vzb-zoomin", true);
          //_this.ui.set("cursorMode", "plus", false, false);
        }
      })
      .on("keyup", () => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (!d3.event.metaKey && !d3.event.ctrlKey) {
          _this.element.select("svg").classed("vzb-zoomin", false);
          //_this.ui.set("cursorMode", "arrow", false, false);
        }
      })
      //this is for the case when user would press ctrl and move away from the browser tab or window
      //keyup event would happen somewhere else and won't be captured, so zoomin class would get stuck
      .on("mouseenter", () => {
        if (_this.ui.cursorMode !== "arrow" && _this.ui.cursorMode !== "hand") return;
        if (!d3.event.metaKey && !d3.event.ctrlKey) {
          _this.ui.cursorMode = "arrow";
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
     const cursor = _this.ui.cursorMode;
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
    this.redrawDataPoints(null, false);
    this._reorderEntities();
    this.map.updateColors();
  },



  /**
   * Changes labels for indicators
   */
  updateIndicators() {
    this.sScale = this.MDL.size.scale.d3Scale;
    this.cScale = color => color? this.MDL.color.scale.d3Scale(color) : COLOR_WHITEISH;

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
    if (this.ui.map.showBubbles) {
      bubbles = this.model.marker.getVisible();
    }

    this.entityBubbles = this.bubbleContainer.selectAll(".vzb-bmc-bubble")
      .data(bubbles, d => d[KEY]);

    //exit selection
    this.entityBubbles.exit().remove();

    //enter selection -- init circles
    this.entityBubbles = this.entityBubbles.enter().append("circle")
      .attr("class", "vzb-bmc-bubble")
      .on("mouseover", (d, i) => {
        if (utils.isTouchDevice() || _this.ui.cursorMode !== "arrow") return;
        _this._interact()._mouseover(d, i);
      })
      .on("mouseout", (d, i) => {
        if (utils.isTouchDevice() || _this.ui.cursorMode !== "arrow") return;
        _this._interact()._mouseout(d, i);
      })
      .on("click", (d, i) => {
        if (utils.isTouchDevice() || _this.ui.cursorMode !== "arrow") return;
        _this._interact()._click(d, i);
        _this.highlightMarkers();
      })
      .onTap((d, i) => {
        _this._interact()._click(d, i);
        d3.event.stopPropagation();
      })
      .onLongTap((d, i) => {
      })
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
      const valueCentroid = values.centroid[utils.getKey(d, dataKeys.centroid)];

      d.hidden_1 = d.hidden;

      if (reposition) {
        const cLoc = _this._getPosition(d);
        if (cLoc) {
          d.cLoc = cLoc;
          view.attr("cx", d.cLoc[0])
            .attr("cy", d.cLoc[1]);
        }
      }
      d.hidden = (!valueS && valueS !== 0) ||  valueCentroid == null || !d.cLoc;

      if (d.hidden !== d.hidden_1) {
        if (duration) {
          view.transition().duration(duration).ease(d3.easeLinear)
            .style("opacity", 0)
            .on("end", () => view.classed("vzb-hidden", d.hidden).style("opacity", _this.model.marker.opacityRegular));
        } else {
          if (!d.hidden) {
            if (d.cLoc) {
              view.classed("vzb-hidden", d.hidden);
            }
          } else {
            view.classed("vzb-hidden", d.hidden);
          }
        }
      }
      if (!d.hidden) {
        d.r = utils.areaToRadius(_this.sScale(valueS || 0));
        d.label = valueL;

        view.classed("vzb-hidden", false)
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
      const offset = utils.areaToRadius(_this.sScale(_this.values.size[utils.getKey(d, dataKeys.size)] || 0));
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
      cache.scaledS0 = valueS ? utils.areaToRadius(_this.sScale(valueS)) : null;
      cache.scaledC0 = valueC != null ? _this.cScale(valueC) : _this.COLOR_WHITEISH;
      const labelText = this.model.marker.getCompoundLabelText(d, this.values);

      this._labels.updateLabel(d, index, cache, valueX / this.width, valueY / this.height, valueS, valueC, labelText, valueLST, duration, showhide);
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



  preload() {
    return this.initMap();
  },

  initMap() {
    this.map = new MapEngine(this, "#vzb-map-background").getMap();
    return this.map.initMap();
  }
};
