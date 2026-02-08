const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow importing data files from the parent data/ directory
config.watchFolders = [path.resolve(__dirname, '..', 'data')];

module.exports = config;

