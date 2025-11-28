module.exports = require("vizabi-tool-bundler")
    .bind(null, 'ExtApiMap', 'extapimap', __dirname, require("./package.json"), {
      "mapbox-gl": "mapboxgl",
      "@deck.gl/core": "deck",
      "@deck.gl/layers": "deck"
    });