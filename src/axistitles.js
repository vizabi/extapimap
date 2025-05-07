import {
    Utils,
    Icons,
    LegacyUtils as utils,
    BaseComponent,
  } from "@vizabi/shared-components";
  
  import {
    decorate, computed, action, observable
  } from "mobx";
    
  const {ICON_QUESTION} = Icons;
  
  class MapTitles extends BaseComponent {
  
    constructor(config) {
      config.template = `
        <g class="vzb-bmc-axis-s-title"><text></text></g>
        <g class="vzb-bmc-axis-c-title"><text></text></g>
        <g class="vzb-bmc-axis-a-title"><text></text></g>

        <g class="vzb-bmc-axis-s-info vzb-noexport"></g>
        <g class="vzb-bmc-axis-c-info vzb-noexport"></g>
        <g class="vzb-bmc-axis-a-info vzb-noexport"></g>
      `;
      super(config);
    }
  
    setup(){
      this.DOM = {
        titles: this.element,
        sTitle: this.element.select(".vzb-bmc-axis-s-title"),
        cTitle: this.element.select(".vzb-bmc-axis-c-title"),
        aTitle: this.element.select(".vzb-bmc-axis-a-title"),
        sInfo: this.element.select(".vzb-bmc-axis-s-info"),
        cInfo: this.element.select(".vzb-bmc-axis-c-info"),
        aInfo: this.element.select(".vzb-bmc-axis-a-info"),
      };
  
      this.strings = { S: "", C: "", A: "" };
  
      this._initInfoElement(this.DOM.sInfo, this.MDL.size);
      this._initInfoElement(this.DOM.cInfo, this.MDL.color);
      this._initInfoElement(this.DOM.aInfo, this.MDL.mapColor);
    }
  
    draw(){
      this.localise = this.services.locale.auto();
  
      this.addReaction(this.updateUIStrings);
      this.addReaction(this.updateTreemenu);
      this.addReaction(this.updateSize, {throttle_ms: 50});
    }
  
    get MDL(){
      return {
        size: this.model.encoding.size,
        color: this.model.encoding.color,
        mapColor: this.model.encoding.color_map,
      };
    }


  
    _initInfoElement(element, model) {
      const _this = this;
      const dataNotesDialog = () => this.root.findChild({type: "DataNotes"});
      const timeSlider = () => this.root.findChild({type: "TimeSlider"});

      utils.setIcon(element, ICON_QUESTION)
        .on("click", () => {
          dataNotesDialog().pin();
        })
        .on("mouseover", function() {
          if (timeSlider().ui.dragging) return;
          const rect = this.getBBox();
          const coord = utils.makeAbsoluteContext(this, this.farthestViewportElement)(rect.x - 10, rect.y + rect.height + 10);
          const toolRect = _this.root.element.node().getBoundingClientRect();
          const chartRect = _this.element.node().getBoundingClientRect();
          dataNotesDialog()
            .setEncoding(model)
            .show()
            .setPos(coord.x + chartRect.left - toolRect.left, coord.y);
        })
        .on("mouseout", () => {
          if (timeSlider().ui.dragging) return;
          dataNotesDialog().hide();
        });
    }



    updateUIStrings() {
      const { size, color, mapColor } = this.MDL;
  
      this.strings = {
        title: {
          S: Utils.getConceptName(size, this.localise), 
          C: Utils.getConceptName(color, this.localise),
          A: Utils.getConceptShortName(mapColor, this.localise)
        }
      };
    
      // TODO: ADD NAME COMPLIMENTS IN EXTAPI MAP
      //   Promise.all([
      //     Utils.getConceptNameCompliment(y),
      //     Utils.getConceptNameCompliment(x),
      //     Utils.getConceptNameCompliment(size),
      //     Utils.getConceptNameCompliment(color)
      //   ]).then(action(response => {        
      //     [ 
      //       this.axisTitleComplimentStrings.Y,
      //       this.axisTitleComplimentStrings.X,
      //       this.axisTitleComplimentStrings.S,
      //       this.axisTitleComplimentStrings.C
      //     ] = response;
      //   }));
    }


  
    updateTreemenu(){
      const treemenu = this.root.findChild({type: "TreeMenu"});
      const isRTL = this.services.locale.isRTL();

  
      this.DOM.sTitle
        .classed("vzb-disabled", treemenu.state.ownReadiness !== Utils.STATUS.READY)
        .on("click", () => {
          treemenu
            .encoding("size")
            .alignX(isRTL ? "right" : "left")
            .alignY("top")
            .updateView()
            .toggle();
        });

      this.DOM.cTitle
        .classed("vzb-disabled", treemenu.state.ownReadiness !== Utils.STATUS.READY)
        .on("click", () => {
          treemenu
            .encoding("color")
            .alignX(isRTL ? "right" : "left")
            .alignY("top")
            .updateView()
            .toggle();
        });

      this.DOM.aTitle
        .classed("vzb-disabled", treemenu.state.ownReadiness !== Utils.STATUS.READY)
        .on("click", () => {
          treemenu
            .encoding("color_map")
            .alignX(isRTL ? "right" : "left")
            .alignY("top")
            .updateView()
            .toggle();
        });  
    }
  
  
  
    updateSize() {
      this.services.layout.size;
   
      const { 
        margin, 
        leftMarginRatio 
      } = this.parent.profileConstants;
  
      const height = (this.parent.elementHeight - margin.top - margin.bottom) || 0;
      const width = (this.parent.elementWidth - margin.left * leftMarginRatio - margin.right) || 0;
  

      this.DOM.titles
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      this._updateTitlesAndInfoElements();
      
      
    }


    _updateTitlesAndInfoElements() {

    const infoElHeight = this.parent.profileConstants.infoElHeight;
    const margin = this.parent.profileConstants.margin;
    const verticalSpacing = infoElHeight * 1.5;
    const isRTL = this.services.locale.isRTL();


    //TITLES

    //hide the first line about bubble size when no bubbles
    const hideSTitle = !this.ui.map.showBubbles;

    //hide the second line about color in large profile or when color is constant or no bubbles
    const colorInSideBar = this.root.ui.dialogs.dialogs.sidebar.includes("colors")
    const sidebarCollapsed = this.root.findChild({type: "ButtonList"})?.ui?.sidebarCollapse;
    const colorLegendAlreadyVisibleInSidebar = this.services.layout.profile === "LARGE" && colorInSideBar && !sidebarCollapsed;
    const hideCTitle = colorLegendAlreadyVisibleInSidebar || this.MDL.color.data.isConstant || !this.ui.map.showBubbles;

    //hide the second line about color in large profile or when color is constant or no bubbles
    const hideATitle = !this.ui.map.showAreas || this.ui.map.useBivariateColorScaleWithDataFromXY;

    function oneTitleLogic({view, dy, hidden, string}){
      view
        .attr("transform", "translate(" + (isRTL ? this.chartWidth : 0) + "," + dy + ")")
        .classed("vzb-hidden", hidden)      
        .select("text").text(string)
        .append("tspan")
        .classed("vzb-noexport", true)
        .style("font-size", (infoElHeight * 0.7) + "px")
        .attr("dx", ( (isRTL ? -1 : 1) * infoElHeight * 0.25) + "px")
        .text("▼");
    }

    oneTitleLogic({
      view: this.DOM.sTitle, 
      hidden: hideSTitle, 
      dy: verticalSpacing, 
      string: this.localise("buttons/size") + ": " + this.strings.title.S
    });
    oneTitleLogic({
      view: this.DOM.cTitle, 
      hidden: hideCTitle, 
      dy: verticalSpacing + (hideSTitle ? 0 : verticalSpacing), 
      string: this.localise("buttons/color") + ": " + this.strings.title.C
    });

    oneTitleLogic({
      view: this.DOM.aTitle, 
      hidden: hideATitle, 
      dy: verticalSpacing + (hideSTitle ? 0 : verticalSpacing) + (hideCTitle ? 0 : verticalSpacing), 
      string: (hideSTitle && hideCTitle ? "" : this.localise("buttons/mapcolors") + ": ") + this.strings.title.A
    });



    // INFO ELEMENTS

    
    function oneInfoElLogic({view, titleView, hidden, model}){
      const isNoInfoData = model => !model.data.conceptProps?.description && !model.data.conceptProps?.sourceLink;

      view.classed("vzb-hidden", hidden || isNoInfoData(model));  

      if (!hidden && view.select("svg").node()) {
        const titleBBox = titleView.node().getBBox();
        const t = utils.transform(titleView.node());
        const hTranslate = isRTL ? (titleBBox.x + t.translateX - infoElHeight * 1.4) : (titleBBox.x + t.translateX + titleBBox.width + infoElHeight * 0.4);
  
        view
          .attr("transform", `translate(${hTranslate},${t.translateY - verticalSpacing * 0.6})`)
          .select("svg")
          .attr("width", infoElHeight)
          .attr("height", infoElHeight);
      }
    }

    oneInfoElLogic({ view: this.DOM.sInfo, titleView: this.DOM.sTitle, hidden: hideSTitle, model: this.MDL.size });
    oneInfoElLogic({ view: this.DOM.cInfo, titleView: this.DOM.cTitle, hidden: hideCTitle, model: this.MDL.color });
    oneInfoElLogic({ view: this.DOM.aInfo, titleView: this.DOM.aTitle, hidden: hideATitle, model: this.MDL.mapColor });




    // COLOR LEGENDS


    const hideBivariateLegend = !this.ui.map.useBivariateColorScaleWithDataFromXY || !this.ui.map.showAreas;
    this.parent.DOM.bivariateLegend
      .style("font-size", infoElHeight + "px")
      .style("top", (margin.top + (hideSTitle ? 0 : verticalSpacing * 1.5) + (hideCTitle ? 0 : verticalSpacing)) + "px")
      .style(isRTL ? "right" : "left", (isRTL ? margin.right : margin.left) + "px")
      .classed("vzb-invisible", hideBivariateLegend);

    const hideColorAreaLegend = this.ui.map.useBivariateColorScaleWithDataFromXY || !this.ui.map.showAreas;
    this.parent.DOM.colorAreaLegend
      //.style("font-size", infoElHeight + "px")
      .style("top", (margin.top + (hideSTitle ? 0 : verticalSpacing) + (hideCTitle ? 0 : verticalSpacing) + (hideATitle ? 0 : verticalSpacing * 1.1)) + "px")
      .style(isRTL ? "right" : "left", (isRTL ? margin.right : margin.left) + "px")
      .classed("vzb-invisible", hideColorAreaLegend);

    }
  }
  
  
  const decorated = decorate(MapTitles, {
    "MDL": computed,
    "strings": observable,
  });
  export { decorated as MapTitles };





























/*



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

  */