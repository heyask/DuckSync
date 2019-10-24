const {
  override,
  addDecoratorsLegacy,
  setWebpackTarget
} = require("customize-cra");

// Adds legacy decorator support to the Webpack configuration.
module.exports = {
  webpack: override(
    addDecoratorsLegacy(),
    setWebpackTarget("electron-renderer")
  )
};
