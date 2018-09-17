# learn webpack

本项目用于阅读学习webpack源码，项目基于webpack3.10.0版本。wepack源码以及注释放在debug_node_modules文件夹下。利用webstorm debug build文件夹下面的webstorm-debugger.js文件，可以debug debug_node_modules文件夹下面的webpack源码。

## 目录结构说明
```
project
|
|-src // webpack编译测试源码
|
|-build // build config
|   |- webpack.config.js // webpack config
|   |- webstorm-debugger.js // 使用webstorm debug该文件，加载debug_node_modules内的webpack代码，进而调试webpack代码。
|
|-debug_node_modules // 存放被阅读和debug的node_modules源码
    |- webpack // 被阅读和debug的webpack源码

```

## 安装阅读说明
1、 git clone https://github.com/aasailan/learnWebpack.git   
2、 npm install   
3、 用webstorm打开项目，打开build/webstorm-debugger.js，右键，debug该文件。

webpack源码阅读注释写在debug_node_modules/webpack文件夹内。

## 阅读流程简要
### 1、shell options 与 webpack config的获取与合并
命令行运行webpack的时候，首先会运行到 webpack/bin/webpack.js这个文件。这个文件内使用yargs这个第三方库对shell config以及webpack config进行了格式检查，确认无误后，对这两个参数进行合并。以下是关键代码：
```javascript
// webpack/bin/webpack.js文件内
...
// 向yargs实例添加config检查规则
require("./config-yargs")(yargs);
...
// 向yargs实例添加shell options检查规则
yargs.options({...})
...
// 传入shell options，在这个函数内扫描webpack config文件，获取webpack config对象
// 重要方法
var options = require("./convert-argv")(yargs, argv);
...
```
convert-argv.js文件内导出了一个函数，该函数内会根据shell options的--config options（没有则加载默认的webpack.config.js）来加载webpack config的配置文件得到webpack config对象。关键代码如下：
``` javascript
// webpack/bin/convert-argv.js文件内
...
if(argv.config) {
  // argv是shell option对象
  // 如果shell option中指定了webpack config文件，则获取指定的config文件(webpack --config)
  var getConfigExtension = function getConfigExtension(configPath) {
    for(i = extensions.length - 1; i >= 0; i--) {
      var tmpExt = extensions[i];
      if(configPath.indexOf(tmpExt, configPath.length - tmpExt.length) > -1) {
        return tmpExt;
      }
    }
    return path.extname(configPath);
  };

  var mapConfigArg = function mapConfigArg(configArg) {
    var resolvedPath = path.resolve(configArg);
    var extension = getConfigExtension(resolvedPath);
    return {
      path: resolvedPath,
      ext: extension
    };
  };

  var configArgList = Array.isArray(argv.config) ? argv.config : [argv.config];
  // 将配置文件路径保存进configFiles数组
  configFiles = configArgList.map(mapConfigArg);
} else {
  // shell option中未指定webpack config文件，则获取获取默认的webpack.config.js文件作为配置文件
  for(i = 0; i < defaultConfigFiles.length; i++) {
    var webpackConfig = defaultConfigFiles[i].path;
    if(fs.existsSync(webpackConfig)) {
      // 将配置文件路径保存进configFiles数组
      configFiles.push({
        path: webpackConfig,
        ext: defaultConfigFiles[i].ext
      });
      break;
    }
  }
}
if(configFiles.length > 0) {
  ...
  var requireConfig = function requireConfig(configPath) {
    var options = require(configPath);
    options = prepareOptions(options, argv);
    return options;
  };

  configFiles.forEach(function(file) {
    registerCompiler(interpret.extensions[file.ext]);
    // 从config files中获取webpack config，并保存进options数组
    options.push(requireConfig(file.path));
  });
  configFileLoaded = true;
}
if(!configFileLoaded) {
  return processConfiguredOptions({});
} else if(options.length === 1) {
  // processConfiguredOptions函数对webpack config对象进行进一步加工
  // 然后返回最终的webpack config对象
  return processConfiguredOptions(options[0]);
} else {
  return processConfiguredOptions(options);
}
...
```
经过convert-argv.js文件的运行，最后得出了需要传递给webpack编译的webpack config对象，然后进入下一步。


### 2、创建compiler对象，调用compiler.run方法开始进入编译过程
```javascript
// 获取webpack函数，在外部require('webpack')得到就是该函数
var webpack = require("../lib/webpack.js");
...
// 关键方法 传入webpack config 得出一个compiler实例
compiler = webpack(options);
...
// 关键方法，开始编译过程
compiler.run(compilerCallback);
```

## 一些关键文件、方法、类、实例
### webpack/bin/webpack.js 文件
主要作用如下：   
  * 命令行中运行webpack，首先运行该文件
  * 使用yargs库检查webpack config对象是否符合规范
  * 合并webpack config对象(从webpack配置文件中导出的对象)和shell config，得出最终的webpack config对象
  * require webpack函数，构建出compiler对象
  * 调用compiler.run 方法，开始webpack编译过程

### wepack/lib/webpack.js 文件
主要作用如下：   
  * 定义webpack函数，返回调用compiler对象，导出webpack函数
  * 向webpack函数对象添加额外属性
  * 使用exportPlugins函数向webpack函数对象添加一些内置插件构造函数。如webpack.optimize.UglifyJsPlugin插件等

## 未完待续...
