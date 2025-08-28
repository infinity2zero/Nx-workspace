// const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
// const { join } = require('path');

// module.exports = {
//   output: {
//     path: join(__dirname, '../../dist/api-server'),
//     ...(process.env.NODE_ENV !== 'production' && {
//       devtoolModuleFilenameTemplate: '[absolute-resource-path]',
//     }),
//   },
//   plugins: [
//     new NxAppWebpackPlugin({
//       target: 'node',
//       compiler: 'tsc',
//       main: './src/main.ts',
//       tsConfig: './tsconfig.app.json',
//       assets: ['./src/assets'],
//       optimization: false,
//       outputHashing: 'none',
//       generatePackageJson: true,
//       sourceMaps: true,
//     }),
//   ],
// };

// apps/api-server/webpack.config.js

// apps/api-server/webpack.config.js

// const { join } = require('path');
// const webpack = require('webpack');

// module.exports = {
//   entry: './src/main.ts',
//   target: 'node',
//   mode: process.env.NODE_ENV || 'production',
//   output: {
//     path: join(__dirname, '../../dist/api-server'),
//     filename: 'main.js',
//     libraryTarget: 'commonjs2',
//     clean: true,
//   },
//   resolve: {
//     extensions: ['.ts', '.js'],
//   },
//   module: {
//     rules: [
//       {
//         test: /\.ts$/,
//         loader: 'ts-loader',
//         exclude: /node_modules/,
//       },
//     ],
//   },
//   externalsPresets: { node: true },  // keep built-ins external
//   externals: [],                      // bundle all npm deps
//   plugins: [
//     // Ignore optional NestJS modules that aren’t installed
//     new webpack.IgnorePlugin({
//       resourceRegExp: /^@nestjs\/(websockets|microservices)(\/.*)?$/
//     }),
//     new webpack.IgnorePlugin({
//       resourceRegExp: /^class-transformer\/storage$/
//     }),
//   ],
//   optimization: {
//     minimize: false,
//   },
//   devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
//   node: {
//     __dirname: false,
//     __filename: false,
//   },
// };
//npx nx run api-server:build:production


// apps/api-server/webpack.config.js
const { join } = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './src/main.ts',
  target: 'node',
  mode: process.env.NODE_ENV || 'production',
  output: {
    path: join(__dirname, '../../dist/api-server'),
    filename: 'main.js',
    libraryTarget: 'commonjs2',
    clean: true,
  },
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [{ test: /\.ts$/, loader: 'ts-loader', exclude: /node_modules/ }]
  },
  externalsPresets: { node: true },  // leave node built-ins external
  externals: [
    nodeExternals({
      allowlist: [],       // bundle everything except what we list below
    }),
    // Externalize better-sqlite3 so it loads from node_modules folder
    /^better-sqlite3$/
  ],
  plugins: [
    new webpack.IgnorePlugin({ resourceRegExp: /^@nestjs\/(websockets|microservices)(\/.*)?$/ }),
    new webpack.IgnorePlugin({ resourceRegExp: /^class-transformer\/storage$/ }),
  ],
  optimization: { minimize: false },
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  node: { __dirname: false, __filename: false },
};
