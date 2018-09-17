/*
 * @Author: qiao 
 * @Date: 2018-09-17 15:58:39 
 * @Last Modified by:   qiao 
 * @Last Modified time: 2018-09-17 15:58:39 
 * 调试 webpack文件
 */

var path = require('path');

require('child_process').exec("npm config get prefix", function(err, stdout, stderr) {
    var nixLib = (process.platform.indexOf("win") === 0) ? "" : "lib"; // win/*nix support

    // var webpackPath = path.resolve(path.join(stdout.replace("\n", ""), nixLib, 'node_modules', 'webpack', 'bin', 'webpack.js'));
    // 加载debug_node_modules内的webpack模块，该模块被添加过阅读注释
    var webpackPath = path.resolve(__dirname, '../debug_node_modules/webpack/bin/webpack.js');
    console.log(webpackPath);

    // 触发webpack的编译操作
    require(webpackPath);
});