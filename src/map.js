const {
  utils,
  helpers: {
    topojson,
    "d3.geoProjection": d3GeoProjection
  },
} = Vizabi;

import GoogleMapsLoader from "google-maps";
import mapboxgl from "mapbox-gl/dist/mapbox-gl.js";

const MapLayer = Vizabi.Class.extend({
  /**
   * Map Instance initialization
   * @param context tool object
   * @param parent map factory instance
   */
  init(context, parent) {
    console.warn("init method should be implemented in map instance");
  },

  /**
   * Drawing map in their dom element
   */
  initMap() {
    console.warn("initMap method should be implemented in map instance");
  },

  /**
   * fit map to screen using ne-sw coordinates
   */
  rescaleMap() {
    console.warn("rescaleMap method should be implemented in map instance");
  },

  /**
   * Move map layer in pixels
   * @param {Integer} x
   * @param {Integer} y
   */
  moveOver(x, y) {
    console.warn("moveOver method should be implemented in map instance");
  },

  /**
   * return current canvas [[left, top], [right, bottom]]
   * @return {Array} []
   */
  getCanvas() {
    console.warn("getCanvas method should be implemented in map instance");
    return [[0, 0], [0, 0]];
  },

  /**
   * return map center {lat: lat, lng lng}
   * @return {Object} {}
   */
  getCenter() {
    console.warn("getCenter method should be implemented in map instance");
    return { lat: 0, lng: 0 };
  },

  /**
   * @param {Array} center
   * @param {bool} increment increase zoom if true
   */
  zoomMap(center, increment) {
    console.warn("zoomMap method should be implemented in map instance");
  },

  /**
   * Translate lat, lon into x, y
   * @param lon
   * @param lat
   * @return {Array} [x, y]
   */
  geo2Point(lon, lat) {
    console.warn("geo2Point method should be implemented in map instance");
    return [0, 0];
  },

  /**
   * Translate x, y  into lat, lon
   * @param x
   * @param y
   * @return {Array} [lon, lat]
   */
  point2Geo(x, y) {
    console.warn("point2Geo method should be implemented in map instance");
    return [0, 0];
  },
});

const TopojsonLayer = MapLayer.extend({
  init(context, parent) {
    this.shapes = null;
    this.mapLands = [];
    this.parent = parent;
    this.context = context;
    this.parent = parent;
    this.paths = {};
    this.areasAreShown = false;
    d3GeoProjection();
  },

  initMap() {
    const _this = this;
    this.mapGraph = this.parent.mapSvg.html("").append("g")
      .attr("class", "vzb-bmc-map-graph");
    
    const assetName = utils.getProp(this.context, ["model", "ui", "map", "topology", "path"])
      || ("assets/world-50m.json");

    const projection = "geo" + utils.capitalize(this.context.model.ui.map.projection);

    this.zeroProjection = d3[projection]();
    this.zeroProjection
      .scale(1)
      .translate([0, 0]);

    this.projection = d3[projection]();
    this.projection
      .scale(1)
      .translate([0, 0]);

    this.mapPath = d3.geoPath()
      .projection(this.projection);


    this.context.model.ui.map.scale = 1;
    return this._loadShapes(assetName).then(
      shapes => {
        _this.shapes = shapes;
        _this.mapFeature = topojson.feature(_this.shapes, _this.shapes.objects[this.context.model.ui.map.topology.objects.geo]);
        _this.mapBounds = _this.mapPath.bounds(_this.mapFeature);
        _this.boundaries = topojson.mesh(_this.shapes, _this.shapes.objects[_this.context.model.ui.map.topology.objects.boundaries], (a, b) => a !== b);
        if (_this.mapFeature.features) {
          utils.forEach(_this.mapFeature.features, (feature, key) => {
            feature.key = feature.properties[_this.context.model.ui.map.topology.geoIdProperty] ?
              feature.properties[_this.context.model.ui.map.topology.geoIdProperty].toString().toLowerCase() : feature.id;
            _this.paths[feature.key] = feature;
          });
        }
      }
    );
  },

  showAreas() {
    const _this = this;
    this.areasAreShown = true;
    if (_this.mapFeature.features) {
      _this.mapLands = _this.mapGraph.selectAll(".land")
        .data(_this.mapFeature.features)
        .enter().insert("path")
        .attr("d", _this.mapPath)
        .attr("class", "land")
        .style("opacity", _this.context.model.marker.opacitySelectDim)
        .on("mouseover", (d, i) => {
          _this.parent._interact()._mouseover(d.key);
        })
        .on("mouseout", (d, i) => {
          _this.parent._interact()._mouseout(d.key);
        })
        .on("click", (d, i) => {
          _this.parent._interact()._click(d.key);
        })
        .onTap((d, i) => {
          _this.parent._interact()._click(d.key);
          d3.event.stopPropagation();
        })
        .each(function(d, i) {
          const view = d3.select(this);
          view
            .attr("id", d.key)
            .style("opacity", d => _this.parent.getOpacity(d.key))
            .style("fill", d => _this.parent.getMapColor(d.key));
        });
    } else {
      _this.mapGraph.insert("path")
        .datum(_this.mapFeature)
        .attr("class", "land");

    }
    _this.mapGraph.insert("path")
      .datum(_this.boundaries)
      .attr("class", "boundary");
  },

  hideAreas() {
    this.areasAreShown = false;
    this.mapGraph.selectAll("*").remove();
  },

  updateOpacity() {
    const _this = this;
    this.mapLands
      .style("opacity", d => _this.parent.getOpacity(d.key));
  },

  updateMapColors() {
    const _this = this;
    this.mapLands
      .style("fill", d => _this.parent.getMapColor(d.key));
  },

  _loadShapes(assetName) {
    const _this = this;
    return new Promise((resolve, reject) => {
      _this.context.model.data.getAsset(assetName, (json) => {
        if (json.success === false) return console.warn("Failed loading json " + assetName + ". " + json.message);
        resolve(json);
      });
    });
  },

  rescaleMap(canvas, preserveAspectRatio) {
    //var topoCanvas =
    let emitEvent = false;
    const margin = this.context.activeProfile ? this.context.activeProfile.margin : {left: 0, top: 0};

    const currentNW = this.zeroProjection([
      this.context.model.ui.map.bounds.west,
      this.context.model.ui.map.bounds.north
    ]);
    const currentSE = this.zeroProjection([
      this.context.model.ui.map.bounds.east,
      this.context.model.ui.map.bounds.south
    ]);
    let scaleDelta = 1, mapTopOffset = 0, mapLeftOffset = 0;

    if (!canvas || preserveAspectRatio) {
      if (!canvas) {
        emitEvent = true;
        canvas = [
          [0, 0],
          [this.context.width, this.context.height]
        ];
        mapTopOffset =  margin.top;
        mapLeftOffset =  margin.left;
      }
      const scaleX = Math.abs((canvas[1][0] - canvas[0][0]) / (currentSE[0] - currentNW[0]));
      const scaleY = Math.abs((canvas[1][1] - canvas[0][1]) / (currentSE[1] - currentNW[1]));
      if (scaleX != scaleY) {
        if (scaleX > scaleY) {
          scaleDelta = scaleY;
          mapLeftOffset += (Math.abs(canvas[1][0] - canvas[0][0]) - Math.abs(scaleDelta * (currentNW[1] - currentSE[1]))) / 2;
        } else {
          scaleDelta = scaleX;
          mapTopOffset += (Math.abs(canvas[1][1] - canvas[0][1]) - Math.abs(scaleDelta * (currentNW[0] - currentSE[0]))) / 2;
        }
      }
    } else {
      scaleDelta = Math.abs((canvas[1][0] - canvas[0][0]) / (currentSE[0] - currentNW[0]));
    }
    // translate projection to the middle of map
    this.projection
      .translate([canvas[0][0] - (currentNW[0] * scaleDelta) + mapLeftOffset - margin.left, canvas[0][1] - (currentNW[1] * scaleDelta) + mapTopOffset - margin.top])
      .scale(scaleDelta)
      .precision(0.1);

    this.mapGraph
      .selectAll("path").attr("d", this.mapPath);

    // resize and put in center
    this.parent.mapSvg
      .style("transform", "translate(" + margin.left + "px," + margin.top + "px)")
      .attr("width", this.context.width)
      .attr("height", this.context.height);

    // set skew function used for bubbles in chart
    const _this = this;
    const x1y1 = this.geo2Point(
      this.context.model.ui.map.bounds.west,
      this.context.model.ui.map.bounds.north
    );
    const x2y2 = this.geo2Point(
      this.context.model.ui.map.bounds.east,
      this.context.model.ui.map.bounds.south
    );

    // if canvas not received this map is main and shound trigger redraw points on tool
    if (emitEvent) {
      this.parent.boundsChanged(false);
    }
  },

  centroid(key) {
    if ((key || key == 0) && this.paths[key]) {
      return this.mapPath.centroid(this.paths[key]);
    }
    return null;
  },

  geo2Point(lon, lat) {
    return this.projection([lon || 0, lat || 0]);
  },

  point2Geo(x, y) {
    return this.projection.invert([x || 0, y || 0]);
  },

  getCanvas() {
    return [
      this.geo2Point(this.context.model.ui.map.bounds.west, this.context.model.ui.map.bounds.north),
      this.geo2Point(this.context.model.ui.map.bounds.east, this.context.model.ui.map.bounds.south)
    ];
  },

  moveOver(x, y) {
    const translate = this.projection.translate();
    this.projection
      .translate([translate[0] + x, translate[1] + y]);

    this.mapGraph
      .selectAll("path").attr("d", this.mapPath);
  },

  zoomMap(center, increment) {
    return new Promise(resolve => {
      const point = this.geo2Point(center[0], center[1]);
      const margin = this.context.activeProfile ? this.context.activeProfile.margin : {left: 0, top: 0};
      const leftOffset = margin.left;//this.context.width / 2 - point[0];
      const topOffset = margin.top;//this.context.height / 2 - point[1];
      const wMod = Math.min(2, Math.max(0, (point[0]) / this.context.width * 2));
      const hMod = Math.min(2, Math.max(0, (point[1]) / this.context.height * 2));
      const wScale = this.context.width * 0.1 * increment;
      const hScale = this.context.height * 0.1 * increment;
      this.rescaleMap([
        [-wScale * wMod + leftOffset, -hScale * hMod + topOffset],
        [
          this.context.width + wScale * (2 - wMod) + leftOffset,
          this.context.height + hScale * (2 - hMod) + topOffset
        ]
      ], true);
      resolve();
    });
  }
});

const GoogleMapLayer = MapLayer.extend({

  init(context, parent) {
    this.context = context;
    this.parent = parent;
    this.bounds = null;
    this.transformation = null;
  },

  initMap(domSelector) {
    const _this = this;
    this.mapCanvas = this.parent.mapRoot;
    this.mapCanvas
      .style("width", "100%")
      .style("height", "100%");

    GoogleMapsLoader.KEY = "AIzaSyAP0vMZwYojifwGYHTnEtYV40v6-MdLGFM";
    return new Promise((resolve, reject) => {
      GoogleMapsLoader.load(google => {
        _this.map = new google.maps.Map(_this.mapCanvas.node(), {
          draggable: false,
          zoomControl: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          disableDefaultUI: true,
          backgroundColor: "#FFFFFF"
        });
        _this.updateLayer();
        _this.overlay = new google.maps.OverlayView();
        _this.overlay.draw = function() {
        };
        _this.overlay.setMap(_this.map);
        // set initial bounds on load, sometimes "rescaleMap" method is not working correctly
        google.maps.event.addListener(_this.map, "bounds_changed", () => {
          if (!this.transformation instanceof Promise) {
            this.transformation = new Promise((resolve) => {
              google.maps.event.addListenerOnce(_this.map, "idle", () => {
                resolve();
                this.transformation = null;
              })
            })
          }
        });

        google.maps.event.addListenerOnce(_this.map, "idle", () => {
          const rectBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(_this.context.model.ui.map.bounds.north, _this.context.model.ui.map.bounds.west),
            new google.maps.LatLng(_this.context.model.ui.map.bounds.south, _this.context.model.ui.map.bounds.east)
          );
          _this.map.fitBounds(rectBounds);
          google.maps.event.trigger(_this.map, "resize");
        });

/*
         const rectangle = new google.maps.Rectangle({
         bounds: {
         north: _this.context.model.ui.map.bounds.north,
         east: _this.context.model.ui.map.bounds.east,
         south: _this.context.model.ui.map.bounds.south,
         west: _this.context.model.ui.map.bounds.west
         },
         editable: true,
         draggable: true
         });
         rectangle.setMap(_this.map);
*/
        resolve();
      });
    });
  },

  _waitMap() {
    if (this.transformation instanceof Promise) {
      return this.transformation;
    } else {
      return new Promise((resolve) => resolve());
    }
  },
  
  updateLayer() {
    if (this.map) {
      const style = this.context.model.ui.map.mapStyle.split(" ");
      this.map.setMapTypeId(style[0]);
      if (style[1]) {
        switch (style[1]) {
          case "grayscale":
            this.map.setOptions({
              styles: [{
                stylers: [{
                  saturation: -100
                }]
              }]
            });
            break;
          default:
            this.map.setOptions({
              styles: []
            });
        }
      } else {
        this.map.setOptions({
          styles: []
        });
      }
    }
  },

  rescaleMap() {
    this._waitMap().then(() => {
      const rectBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(this.context.model.ui.map.bounds.north, this.context.model.ui.map.bounds.west),
        new google.maps.LatLng(this.context.model.ui.map.bounds.south, this.context.model.ui.map.bounds.east)
      );
      this.map.fitBounds(rectBounds);
      google.maps.event.trigger(this.map, "resize");
      google.maps.event.addListener(this.map, "idle", () => {
        const bounds = this.map.getBounds();
        if (bounds && (!this.bounds || this.bounds != bounds)) {
          this.bounds = bounds;
          this.parent.boundsChanged();
        }
      });
    })
  },

  zoomMap(center, increment) {
    const _this = this;
    return new Promise((resolve, reject) => {
      const zoomPoint = this.geo2Point(center[0], center[1]);
      _this.map.setZoom(_this.map.getZoom() + 1 * increment);
      const zoomPoint1 = this.geo2Point(center[0], center[1]);
      _this.map.panBy(zoomPoint1[0] - zoomPoint[0], zoomPoint1[1] - zoomPoint[1]);
      google.maps.event.addListenerOnce(_this.map, "idle", () => {
        resolve();
      });
    });
  },


  geo2Point(x, y) {
    const projection = this.overlay.getProjection();
    if (!projection) {
      return null;
    }
    const coords = projection.fromLatLngToContainerPixel(new google.maps.LatLng(y, x));
    return [coords.x, coords.y];
  },

  point2Geo(x, y) {
    const projection = this.map.getProjection();
    const ne = this.map.getBounds().getNorthEast();
    const sw = this.map.getBounds().getSouthWest();
    const topRight = projection.fromLatLngToPoint(ne);
    const bottomLeft = projection.fromLatLngToPoint(sw);
    const scale = Math.pow(2, this.map.getZoom());
    const point = projection.fromPointToLatLng(new google.maps.Point(x / scale + bottomLeft.x, y / scale + topRight.y));
    return [point.lng(), point.lat()];
  },

  moveOver(x, y) {
    const _this = this;
    return new Promise((resolve, reject) => {
      _this.map.panBy(-x, -y);
      google.maps.event.addListenerOnce(_this.map, "idle", () => {
        resolve();
      });
    });
  },

  getZoom() {
    return this.map.getZoom();
  },

  getCanvas() {
    return [
      this.geo2Point(this.context.model.ui.map.bounds.west, this.context.model.ui.map.bounds.north),
      this.geo2Point(this.context.model.ui.map.bounds.east, this.context.model.ui.map.bounds.south)
    ];
  },

  getCenter() {
    const center = this.map.getCenter();
    return { lat: center.lat(), lng: center.lng() };
  }
});

const MapboxLayer = MapLayer.extend({

  init(context, parent) {
    mapboxgl.accessToken = "pk.eyJ1Ijoic2VyZ2V5ZiIsImEiOiJjaXlqeWo5YnYwMDBzMzJwZnlwZXJ2bnA2In0.e711ku9KzcFW_x5wmOZTag";
    this.context = context;
    this.parent = parent;
  },

  initMap() {
    const _this = this;
    this.mapCanvas = this.parent.mapRoot;
    return new Promise((resolve, reject) => {
      _this.map = new mapboxgl.Map({
        container: _this.mapCanvas.node(),
        interactive: false,
        style: this.context.model.ui.map.mapStyle,
        hash: false
      });
      _this.bounds = [[
        _this.context.model.ui.map.bounds.west,
        _this.context.model.ui.map.bounds.south
      ], [
        _this.context.model.ui.map.bounds.east,
        _this.context.model.ui.map.bounds.north
      ]];
      _this.map.fitBounds(_this.bounds);
      resolve();
    });
  },

  rescaleMap(duration) {
    const _this = this;
    _this.bounds = [[
      _this.context.model.ui.map.bounds.west,
      _this.context.model.ui.map.bounds.south
    ], [
      _this.context.model.ui.map.bounds.east,
      _this.context.model.ui.map.bounds.north
    ]];
    utils.defer(() => {
      if (!duration) duration = 0;
      _this.map.fitBounds(_this.bounds, { duration: duration });
      _this.map.resize();
      if (duration) {
        utils.delay(duration).then(() => {
          _this.parent.boundsChanged();
        });        
      } else {
        _this.parent.boundsChanged();
      }
    });
  },

  getCenter() {
    const center = this.map.getCenter();
    return { lat: center.lat, lng: center.lng };
  },

  moveOver(dx, dy) {
    this.map.panBy([-dx, -dy], { duration: 0 });
  },

  zoomMap(center, increment) {
    const _this = this;
    return new Promise((resolve, reject) => {
      this.map.easeTo({
        duration: 300,
        around: center,
        zoom: _this.map.getZoom() + 1 * increment
      });
      utils.delay(300).then(
        () => {
          resolve();
        }
      );
    });
  },

  updateLayer() {
    if (this.map) {
      this.map.setStyle(this.context.model.ui.map.mapStyle);
    }
  },

  getCanvas() {
    return [
      this.geo2Point(this.context.model.ui.map.bounds.west, this.context.model.ui.map.bounds.north),
      this.geo2Point(this.context.model.ui.map.bounds.east, this.context.model.ui.map.bounds.south)
    ];
  },

  geo2Point(lon, lat) {
    const coords = this.map.project([lon, lat]);
    return [coords.x, coords.y];
  },

  point2Geo(x, y) {
    const geo = this.map.unproject([x, y]);
    return [geo.lng, geo.lat];
  }


});

export default Vizabi.Class.extend({
  init(context, domSelector) {
    this.context = context;
    this.domSelector = domSelector;
    this.zooming = false;
    this.topojsonMap = null;
    this.keys = {};
    this.mapEngine = this.context.model.ui.map.mapEngine;
    this.mapInstance = null;
    if (this.context.element instanceof d3.selection) {
      this.mapRoot = this.context.element.select(domSelector);
      this.mapSvg = this.context.element.select(".vzb-bmc-map-background");
    } else {
      this.mapRoot = d3.select(this.context.element).select(domSelector);
      this.mapSvg = d3.select(this.context.element).select(".vzb-bmc-map-background");
    }
    this.mapRoot.html("");
    this.mapSvg.html("");
    return this;
  },

  getMap() {
    if (!this.mapInstance) {
      if (this.context.model.ui.map.showMap) {
        switch (this.context.model.ui.map.mapEngine) {
          case "google":
            this.mapInstance = new GoogleMapLayer(this.context, this);
            break;
          case "mapbox":
            this.mapInstance = new MapboxLayer(this.context, this);
            break;
        }
      }
      if (!this.topojsonMap) {
        this.topojsonMap = new TopojsonLayer(this.context, this);
      }
      return this;
    }
  },

  initMap() {
    if (!this.mapInstance) {
      return this.topojsonMap.initMap(this.domSelector).then(() => {
        this.topojsonMap.showAreas();
      });
    }
    const topojsonPromise = this.topojsonMap.initMap(this.domSelector);
    if (this.context.model.ui.map.showAreas) {
      topojsonPromise.then(() => {
        this.topojsonMap.showAreas();
      });
    }
    return Promise.all([
      this.mapInstance.initMap(this.domSelector),
      topojsonPromise
    ]);
  },

  ready() {
    const _this = this;
    this._bounds = null;
    let x1, y1, x2, y2;
    this.keys = Object.keys(_this.context.values.hook_centroid)
      .reduce((obj, key) => {
        obj[_this.context.values.hook_centroid[key]] = key;
        return obj;
      }, {});
    utils.forEach(this.keys, (val, key) => {
      const centroid = this.topojsonMap.centroid(key);
      if (!centroid) return;
      if ((!x1 && x1 != 0) || x1 > centroid[0]) {
        x1 = centroid[0];
      }
      if ((!x2 && x2 != 0) || x2 < centroid[0]) {
        x2 = centroid[0];
      }
      if ((!y1 && y1 != 0) || y1 > centroid[1]) {
        y1 = centroid[1];
      }
      if ((!y2 && y2 != 0) || y2 < centroid[1]) {
        y2 = centroid[1];
      }
    });
    if (x1 < x2 && y1 < y2) {
      const nw = this.topojsonMap.point2Geo(x1, y1);
      const se = this.topojsonMap.point2Geo(x2, y2);
      this._bounds = {
        west: nw[0],
        north: nw[1],
        east: se[0],
        south: se[1]
      };
    }
    this.context.mapBoundsChanged();
  },

  rescaleMap() {
    if (this.mapInstance) {
      const margin = this.context.activeProfile.margin;
      const _this = this;
      this.mapRoot
        .attr("width", this.context.width + margin.left + margin.right)
        .attr("height", this.context.height + margin.top + margin.bottom)
        .style("position", "absolute")
        .style("left", 0)
        .style("right", 0)
        .style("top", 0)
        .style("bottom", 0);
      this.mapInstance.rescaleMap();
    } else {
      this.topojsonMap.rescaleMap();
    }
  },

  layerChanged() {
    if (this.mapEngine == this.context.model.ui.map.mapEngine &&
      this.context.model.ui.map.showMap &&
      this.mapInstance) {
      if (this.topojsonMap.areasAreShown != this.context.model.ui.map.showAreas) {
        if (!this.context.model.ui.map.showAreas) {
          this.topojsonMap.hideAreas();
        } else {
          this.topojsonMap.showAreas();
        }
      }
      this.mapInstance.updateLayer();
    } else {
      this.mapEngine = this.context.model.ui.map.mapEngine;
      this.mapInstance = null;
      this.mapRoot.html("");
      this.getMap();
      this.initMap(this.domSelector).then(
        () => {
          if (this.mapInstance) {
            this.mapInstance.rescaleMap();
          } else {
            this.topojsonMap.rescaleMap();
          }
        });
    }
  },

  getMapColor(key) {
    if (this.keys[key]) {
      return this.context.mcScale(this.context.values.color_map[this.keys[key]]);
    }
    return this.context.COLOR_WHITEISH;
  },

  getOpacity(key) {
    if (this.keys[key]) {
      return this.context.getMapOpacity(this.keys[key]);
    }
    return this.context.COLOR_WHITEISH;
  },

  updateColors() {
    if (this.context.model.ui.map.showAreas) {
      this.topojsonMap.updateMapColors();
    }
  },

  _getCenter() {
    if (this.mapInstance) {
      return this.mapInstance.getCenter();
    }
    return this.topojsonMap.getCenter();
  },
  
  resetZoom(duration) {
    if (this._bounds) {
      this._hideTopojson();
      this.context.model.ui.map.bounds = {
        west: this._bounds.west,
        north: this._bounds.north,
        east: this._bounds.east,
        south: this._bounds.south
      };
      if (this.mapInstance) {
        this.mapInstance.rescaleMap(duration);
      } else {
        this.topojsonMap.rescaleMap(duration);
      }
      if (!duration) duration = 0;
      return new Promise((resolve, reject) => {
        utils.delay(duration).then(() => {
          this._showTopojson(300)
          resolve();
        });
      })
    } 
  },
  
  panStarted() {
    this.zooming = true;
    if (this.context.model.ui.map.showMap) {
      this._hideTopojson();
    }
    this.canvasBefore = this.getCanvas();
  },

  panFinished() {
    const nw = this.point2Geo(this.canvasBefore[0][0], this.canvasBefore[0][1]);
    const se = this.point2Geo(this.canvasBefore[1][0], this.canvasBefore[1][1]);
    this.context.model.ui.map.bounds = {
      west: nw[0],
      north: nw[1],
      east: se[0],
      south: se[1]
    };
    this.zooming = false;
    this.boundsChanged();
    this._showTopojson(300);
  },

  zoomRectangle(x1, y1, x2, y2) {
    const nw = this.point2Geo(Math.min(x1, x2), Math.min(y1, y2));
    const se = this.point2Geo(Math.max(x1, x2), Math.max(y1, y2));
    this.context.model.ui.map.bounds = {
      west: nw[0],
      north: nw[1],
      east: se[0],
      south: se[1]
    };
    this.zooming = false;
    if (this.mapInstance) {
      this.mapInstance.rescaleMap();
    } else {
      this.topojsonMap.rescaleMap();
    }
    this._showTopojson(300);
  },

  moveOver(dx, dy) {
    if (this.mapInstance) {
      return this.mapInstance.moveOver(dx, dy);
    }
    this.topojsonMap.moveOver(dx, dy);
  },

  _interact() {
    return this.context._mapIteract();
  },

  updateOpacity() {
    if (this.context.model.ui.map.showAreas) {
      this.topojsonMap.updateOpacity();
    }
  },

  _hideTopojson(duration) {
    if (this.context.model.ui.map.showAreas) {
      if (duration) {
        this.topojsonMap.mapGraph
          .transition()
          .duration(duration)
          .style("opacity", 0);
      } else {
        this.topojsonMap.mapGraph
          .style("opacity", 0);
      }
    }
  },

  _showTopojson(duration) {
    if (this.context.model.ui.map.showAreas) {
      this.topojsonMap.mapGraph
        .interrupt()
        .transition()
        .duration(duration)
        .style("opacity", duration);
    }
  },

  /**
   * @param {Array} center
   * @param {Integer} increment increase zoom if 1 decrease if -1
   */
  zoomMap(center, increment) {
    const _this = this;
    const geoCenter = this.point2Geo(center[0], center[1]);
    this.canvasBefore = this.getCanvas();
    this.zooming = true;
    if (this.context.model.ui.map.showMap) {
      this._hideTopojson(100);
    }
    let response;
    if (this.mapInstance) {
      response = this.mapInstance.zoomMap(geoCenter, increment);
    } else if (this.context.model.ui.map.showAreas) {
      response = this.topojsonMap.zoomMap(geoCenter, increment);
    }
    return response.then(
      bounds => {
        const nw = this.point2Geo(this.canvasBefore[0][0], this.canvasBefore[0][1]);
        const se = this.point2Geo(this.canvasBefore[1][0], this.canvasBefore[1][1]);
        _this.context.model.ui.map.bounds = {
          west: nw[0],
          north: nw[1],
          east: se[0],
          south: se[1]
        };
        this.zooming = false;
        this.boundsChanged();
        /*
         if (_this.mapInstance) {
         _this.mapInstance.rescaleMap();
         } else {
         */
//          _this.topojsonMap.rescaleMap();
//        }
        this._showTopojson(300);
      }
    );
  },

  boundsChanged(rescaleTopojson = true) {
    if (!this.zooming) {
      if (rescaleTopojson) {
        let canvas;
        if (this.mapInstance) {
          canvas = this.mapInstance.getCanvas();
        }
        this.topojsonMap.rescaleMap(canvas);
      }
      this.context.mapBoundsChanged();
    }
  },

  centroid(key) {
    if (this.topojsonMap) {
      return this.topojsonMap.centroid(key);
    }
    return null;
  },

  getCanvas() {
    if (this.mapInstance) {
      return this.mapInstance.getCanvas();
    } else if (this.context.model.ui.map.showAreas) {
      return this.topojsonMap.getCanvas();
    }
    return [[0, 0], [0, 0]];
  },
  point2Geo(x, y) {
    if (this.mapInstance) {
      return this.mapInstance.point2Geo(x, y);
    } else if (this.context.model.ui.map.showAreas) {
      return this.topojsonMap.point2Geo(x, y);
    }
    return [0, 0];
  },

  geo2Point(lon, lat) {
    if (this.mapInstance) {
      return this.mapInstance.geo2Point(lon, lat);
    } else if (this.context.model.ui.map.showAreas) {
      return this.topojsonMap.geo2Point(lon, lat);
    }
    return [0, 0];
  }

});
