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
命令行运行webpack的时候，首先会运行到 webpack/bin/webpack.js这个文件。这个文件内使用yargs这个第三方库对shell options以及webpack config进行了格式检查，确认无误后，对这两个参数进行合并。以下是关键代码：
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
// webpack/bin/webpack.js文件内
// 获取webpack函数，在外部require('webpack')得到就是该函数
var webpack = require("../lib/webpack.js");
...
// 关键方法 传入webpack config 得出一个compiler实例
compiler = webpack(options);
...
// 关键方法，开始编译过程
compiler.run(compilerCallback);
```
webpack是一个比较关键的函数，这个函数内创建了compiler对象，并且在compiler对象上注册了webpack config上配置好的所有插件。同时这个文件还在webpack上添加了所有webpack内置的插件，比如我们常用的webpack.optimize.UglifyJsPlugin插件。
```javascript
// webpack/lib/webpack.js文件内
/**
 * @description 用户require('webpack')导出的就是该函数，用于开启编译过程
 * @param {*} options webpack config
 * @param {*} callback 回调函数
 * @returns compiler
 */
function webpack(options, callback) {
  // 检查webpack config对象
  const webpackOptionsValidationErrors = validateSchema(webpackOptionsSchema, options);
  if(webpackOptionsValidationErrors.length) {
    throw new WebpackOptionsValidationError(webpackOptionsValidationErrors);
  }
  let compiler;
  if(Array.isArray(options)) {
    // 如果webpack config最外层是数组形式，则使用MultiCompiler
    compiler = new MultiCompiler(options.map(options => webpack(options)));
  } else if(typeof options === "object") {
    // 如果传入的webpack config是一个object（通常传入的都是一个object，所以重点查看此处）
    // TODO webpack 4: process returns options
    new WebpackOptionsDefaulter().process(options);
    // 创建Compiler实例
    compiler = new Compiler();
    compiler.context = options.context;
    compiler.options = options;
    // 注册NodeEnvironmentPlugin插件，里面向compiler注册了 'before-run' hook
    new NodeEnvironmentPlugin().apply(compiler);
    if(options.plugins && Array.isArray(options.plugins)) {
    // 注册webpack config 中的插件
      compiler.apply.apply(compiler, options.plugins);
    }
    // 触发environment和after-environment hook
    compiler.applyPlugins("environment");
    compiler.applyPlugins("after-environment");
    // 关键方法 这个方法将会针对我们传进去的webpack config 进行逐一编译，接下来我们再来仔细看看这个模块。
    compiler.options = new WebpackOptionsApply().process(options, compiler);
  } else {
    throw new Error("Invalid argument: options");
  }
  if(callback) {
  // 如果提供了回调函数，则立即调用compiler.run 进行编译过程
    if(typeof callback !== "function") throw new Error("Invalid argument: callback");
    if(options.watch === true || (Array.isArray(options) && options.some(o => o.watch))) {
      const watchOptions = Array.isArray(options) ? options.map(o => o.watchOptions || {}) : (options.watchOptions || {});
      return compiler.watch(watchOptions, callback);
    }
    compiler.run(callback);
  }
  return compiler;
}
exports = module.exports = webpack;

...
function exportPlugins(obj, mappings) {
	Object.keys(mappings).forEach(name => {
		Object.defineProperty(obj, name, {
			configurable: false,
			enumerable: true,
			get: mappings[name]
		});
	});
}
// 向webpack函数对象添加内置插件的构造函数
exportPlugins(exports, {
	"DefinePlugin": () => require("./DefinePlugin"),
  ...
});
// 向webpack.optimize 添加内置插件构造函数
exportPlugins(exports.optimize = {}, {
  ...
	"UglifyJsPlugin": () => require("./optimize/UglifyJsPlugin")
});

```
Compiler对象是webpack编译过程中非常重要的一个对象。compiler对象代表的是配置完备的Webpack环境。compiler对象只在Webpack启动时构建一次，由Webpack组合所有的配置项构建生成。Compiler 继承自Tapable类，借助继承的Tapable类，Compiler具备有被注册监听事件，以及发射事件触发hook的功能，webpack的插件机制也由此形成。大多数面向用户的插件，都是首先在 Compiler 上注册的。   
插件注册，可见下面的*一些细节章节*。   
webpack的编译构建流程，由compiler.run()开始进入
```javascript
// webpack/lin/Complier.js文件内
/**
* @description 由该方法开始进入webpack编译流程
* @param {*} callback 编译完成后回调函数
* @memberof Compiler
*/
run(callback) {
  const startTime = Date.now();

  // 定义compile后的回调函数
  const onCompiled = (err, compilation) => {
    ...
  };

  // 触发before-run事件，compiler生命周期事件
  // 具体参考：https://webpack.js.org/api/compiler-hooks/
  this.applyPluginsAsync("before-run", this, err => {
    if(err) return callback(err);
    // 触发run事件，compiler生命周期事件
    this.applyPluginsAsync("run", this, err => {
      if(err) return callback(err);

      this.readRecords(err => {
        if(err) return callback(err);
        // 关键方法：在此键入具体的编译构建流程
        this.compile(onCompiled);
      });
    });
  });
}
```

### 创建compilation对象，触发make事件，开始从入口文件加载处理module
在compiler实例的compile方法内，创建出compilation对象，触发关键的make生命周期，并在make声明周期的回调内调用 compilation的addEntry方法，开始从入口文件加载处理module
```javascript
// webpack/lib/compiler.js文件内
/**
* @description 从这个方法开始具体的编译构建流程
* @param {*} callback
* @memberof Compiler
*/
compile(callback) {
  const params = this.newCompilationParams();
  // 触发 before-compile 生命周期
  this.applyPluginsAsync("before-compile", params, err => {
    if(err) return callback(err);
    // 触发compile 生命周期
    this.applyPlugins("compile", params);
    // 创建关键的compilation实例
    const compilation = this.newCompilation(params);
    // 触发make生命周期，在make生命周期内，开始加载module完成module的编译
    this.applyPluginsParallel("make", compilation, err => {
      if(err) return callback(err);

      compilation.finish();
      // 关键方法：在seal方法内进行编译完的chunk封装，并最后输出为bundle
      compilation.seal(err => {
        if(err) return callback(err);
        // 触发after-compile生命周期
        this.applyPluginsAsync("after-compile", compilation, err => {
          if(err) return callback(err);

          return callback(null, compilation);
        });
      });
    });
  });
}
```

## 一些细节
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

### 插件注册
插件注册通常是插件实例在Tapable类或者其后代实例中（通常就是Compiler和Compilation实例）注册监听事件，然后等待webpack构建过程中触发监听事件，运行hook进行插件逻辑处理。大多数面向用户的插件，都是首先在 Compiler 上注册监听事件的。插件通常需要提供一个apply方法，用来传入 Compiler 实例注册监听事件，下面展示NodeEnvironmentPlugin插件的代码作为示例：
```javascript
class NodeEnvironmentPlugin {
  // 插件通常提供apply方法，用来传入compiler，在compiler实例上注册监听事件
	apply(compiler) {
		compiler.inputFileSystem = new CachedInputFileSystem(new NodeJsInputFileSystem(), 60000);
		const inputFileSystem = compiler.inputFileSystem;
		compiler.outputFileSystem = new NodeOutputFileSystem();
		compiler.watchFileSystem = new NodeWatchFileSystem(compiler.inputFileSystem);
    // 使用compiler.plugin方法，注册 'before-run' 事件，并提供hook函数
    compiler.plugin("before-run", (compiler, callback) => {
			if(compiler.inputFileSystem === inputFileSystem)
				inputFileSystem.purge();
			callback();
		});
	}
}
```
 
## 未完待续...
