/*
 * @Author: qiao 
 * @Date: 2018-09-17 15:56:05 
 * @Last Modified by: qiao
 * @Last Modified time: 2019-09-01 20:46:17
 * webpack config
 */
const path = require('path');

 module.exports = {
  entry: path.resolve(__dirname, '../src/index.js'),
  output: {
    path: path.resolve(__dirname, '../dist'),
    // 入口文件生成的chunk
    filename: '[name].js',
    // This option determines the name of non-entry chunk files.
    chunkFilename: '[id].[chunkhash].js',
  },
  module: {
    rules: [
      { 
				test: /\.js$/, // js 编译
        // use: ['babel-loader'],
        loader: 'babel-loader',
        include: [
          path.join(__dirname, '../src'),
        ],
        options: {
          presets: ['@babel/preset-env'],
          plugins: ['@babel/plugin-syntax-dynamic-import']
        }
      },
      { // 图片编译
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          // name: utils.assetsPath('img/[name].[hash:7].[ext]')
          name: path.join(__dirname, '../dist/img/[name].[hash:7].[ext]'),
        }
      },
    ],
  },
 };
