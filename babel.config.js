// The project path contains "#" ("D:\# Uni\..."). react-native-worklets 0.13+
// strips everything after "?" or "#" from source-map paths, so it tries to
// read "D:\" and fails with EISDIR. Turning off worklet source maps avoids that
// read. This file can be deleted if the project moves to a path without "#".
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { worklets: false, reanimated: false }]],
    plugins: [['react-native-worklets/plugin', { disableSourceMaps: true }]],
  };
};
