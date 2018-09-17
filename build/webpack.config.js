/*
 * @Author: qiao 
 * @Date: 2018-09-17 15:56:05 
 * @Last Modified by: qiao
 * @Last Modified time: 2018-09-17 16:02:02
 * webpack config
 */
const path = require('path');

 module.exports = {
  entry: path.resolve(__dirname, '../src/index.js'),
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].js'
  }
 };
