# learn webpack

本项目用于阅读学习webpack源码，项目基于webpack3.10.0版本。wepack源码以及注释放在debug_node_modules文件夹下。利用webstorm debug build文件夹下面的webstorm-debugger.js文件，可以debug debug_node_modules文件夹下面的webpack源码。

#### 由于当前webpack已经升级到webpack4，官方网站的文档已经切换到webpack4。webpack3的文档可在 https://webpack-v3.jsx.app/ 或者 https://github.com/webpack/webpack.js.org/blob/v3.11.0/src/content/index.md 中获取

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
yargs.options({
  ...
})
...

// NOTE: 重要方法 传入shell options，在这个函数内扫描webpack config文件，获取webpack config对象（函数返回的options对象就是）
// argv为shell options参数
var options = require("./convert-argv")(yargs, argv);
...
```
convert-argv.js文件内导出了一个函数，该函数内会根据shell options的--config options（没有则加载默认的webpack.config.js）来加载webpack config的配置文件得到webpack config对象。关键代码如下：
``` javascript
// webpack/bin/convert-argv.js文件内
...
if(argv.config) {
  // argv是shell option对象
  // NOTE: 如果shell option中指定了webpack config文件，则获取指定的config文件(webpack --config)
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
  // NOTE: 将webpack --config选项保存成数组
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

// NOTE: 经过上面的处理，configFiles中保存了所有webpack config文件的绝对路径，如下所示：
// configFiles = [
//   {
//     path: '这里保存webpack config文件的绝对路径',
//     ext: '这里保存webpack config文件的后缀',
//   },
//   ...
// ];
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


### 2、创建compiler对象，在compiler对象上加载必要插件，调用compiler.run方法开始进入编译过程
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
webpack是一个比较关键的函数，这个函数内创建了compiler对象，并且在**compiler对象上注册了webpack config上配置好的所有插件**。同时这个文件还在webpack上添加了所有webpack内置的插件，比如我们常用的webpack.optimize.UglifyJsPlugin插件。
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
    // NOTE: 如果webpack config最外层是数组形式，则使用MultiCompiler
    compiler = new MultiCompiler(options.map(options => webpack(options)));
  } else if(typeof options === "object") {
    // NOTE: 如果传入的webpack config是一个object（通常传入的都是一个object，所以重点查看此处）
    // TODO webpack 4: process returns options
    new WebpackOptionsDefaulter().process(options);
    // 创建Compiler实例
    compiler = new Compiler();
    compiler.context = options.context;
    compiler.options = options;
    // 注册NodeEnvironmentPlugin插件，里面向compiler注册了 'before-run' hook
    new NodeEnvironmentPlugin().apply(compiler);
    if(options.plugins && Array.isArray(options.plugins)) {
      // NOTE: 注册webpack config 中用户设置的插件
      compiler.apply.apply(compiler, options.plugins);
    }
    // 触发environment和after-environment hook
    compiler.applyPlugins("environment");
    compiler.applyPlugins("after-environment");
    // NOTE: 关键方法 这个方法将会针对我们传进去的webpack config 进行逐一编译，然后注册许多关键插件
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
上面源码中**WebpackOptionsApply类的process方法**非常重要。这个方法中根据webpack config对象对compiler注册了不同的插件，以及一些通用的插件。这些插件都比较关键，比如有**负责调用loader的LoaderPlugin**，有负责**注册make事件钩子的EntryOptionPlugin**等。这些插件在后面的构建生命周期中起到关键作用。
WebpackOptionsApply类的process如下：
```javascript
// webpack/lib/WebpackOptionsApply.js文件内
/**
* @description 根据webpack config对象，对compiler添加一些必要属性，以及加载必要的插件
* @param {*} options
* @param {*} compiler
* @returns
* @memberof WebpackOptionsApply
*/
process(options, compiler) {
  let ExternalsPlugin;
  // 给compiler添加必要属性
  compiler.outputPath = options.output.path;
  compiler.recordsInputPath = options.recordsInputPath || options.recordsPath;
  compiler.recordsOutputPath = options.recordsOutputPath || options.recordsPath;
  compiler.name = options.name;
  compiler.dependencies = options.dependencies;
  // 处理webpack config target选项
  if(typeof options.target === "string") {
    let JsonpTemplatePlugin;
    let NodeSourcePlugin;
    let NodeTargetPlugin;
    let NodeTemplatePlugin;
    // NOTE: 以下根据不同的target加载不同的插件
    switch(options.target) {
      case "web":
        // 针对前端打包环境加载插件
        JsonpTemplatePlugin = require("./JsonpTemplatePlugin");
        NodeSourcePlugin = require("./node/NodeSourcePlugin");
        compiler.apply(
          new JsonpTemplatePlugin(options.output),
          new FunctionModulePlugin(options.output),
          new NodeSourcePlugin(options.node),
          new LoaderTargetPlugin(options.target)
        );
        break;
      case "webworker":
        ...
      case "node":
      case "async-node":
        ...
        break;
      case "node-webkit":
        ...
        break;
      case "atom":
      case "electron":
      case "electron-main":
        ...
        break;
      case "electron-renderer":
        ...
        break;
      default:
        throw new Error("Unsupported target '" + options.target + "'.");
    }
  } else if(options.target !== false) {
    options.target(compiler);
  } else {
    throw new Error("Unsupported target '" + options.target + "'.");
  }

  if(options.output.library || options.output.libraryTarget !== "var") {
    // 针对output.library选项加载插件
    ...
  }
  if(options.externals) {
    // 处针对externals选项加载插件
    ... 
  }
  let noSources;
  let legacy;
  let modern;
  let comment;
  // 处理devtool选项
  if(options.devtool && (options.devtool.indexOf("sourcemap") >= 0 || options.devtool.indexOf("source-map") >= 0)) {
    ...
  } else if(options.devtool && options.devtool.indexOf("eval") >= 0) {
    ...
  }
  
  // NOTE: 重要插件：在EntryOptionPlugin插件内加载了 DynamicEntryPlugin 插件，进而注册了make事件回调钩子
  // 在make事件回调钩子中，webpack会调用compiltion.addEntry()方法，开始加载和build模块
  compiler.apply(new EntryOptionPlugin());
  
  compiler.applyPluginsBailResult("entry-option", options.context, options.entry);

  // 加载编译相关插件
  compiler.apply(
    new CompatibilityPlugin(),
    new HarmonyModulesPlugin(options.module),
    new AMDPlugin(options.module, options.amd || {}),
    // 为编译提供commonjs规范支持的插件
    new CommonJsPlugin(options.module),
    // loader插件，该插件在 compilation 上注册normal-module-loader事件，并在该回调钩子内调用loader
    new LoaderPlugin(),
    new NodeStuffPlugin(options.node),
    new RequireJsStuffPlugin(),
    new APIPlugin(),
    new ConstPlugin(),
    new UseStrictPlugin(),
    new RequireIncludePlugin(),
    new RequireEnsurePlugin(),
    new RequireContextPlugin(options.resolve.modules, options.resolve.extensions, options.resolve.mainFiles),
    new ImportPlugin(options.module),
    new SystemPlugin(options.module)
  );

  // 加载chunk处理相关插件
  compiler.apply(
    new EnsureChunkConditionsPlugin(),
    new RemoveParentModulesPlugin(),
    new RemoveEmptyChunksPlugin(),
    new MergeDuplicateChunksPlugin(),
    new FlagIncludedChunksPlugin(),
    new OccurrenceOrderPlugin(true),
    new FlagDependencyExportsPlugin(),
    new FlagDependencyUsagePlugin()
  );

  if(options.performance) {
    compiler.apply(new SizeLimitsPlugin(options.performance));
  }

  compiler.apply(new TemplatedPathPlugin());

  compiler.apply(new RecordIdsPlugin());

  compiler.apply(new WarnCaseSensitiveModulesPlugin());

  if(options.cache) {
    ...
    // 处理cache选项
  }

  compiler.applyPlugins("after-plugins", compiler);
  ... 
  compiler.applyPlugins("after-resolvers", compiler);
  return options;
}
```
上述process方法中加载很多关键的插件，这里关注其中的**EntryOptionPlugin**。EntryOptionPlugin插件中又根据入口文件是否多个注册了**MultiEntryPlugin或者SingleEntryPlugin**，这两个插件会在compiler中**注册make回调钩子**，并在这个回调钩子中，调用compilation.addEntry方法开从入口文件解析并加载module。
以下是EntryOptionPlugin内的关键代码：
```javascript
// webpack/lib/EntryOptionPlugin.js文件内
function itemToPlugin(context, item, name) {
	if(Array.isArray(item)) {
    // entry为数组时，多入口文件
		return new MultiEntryPlugin(context, item, name);
  }
  // entry不为数组，单入口文件
	return new SingleEntryPlugin(context, item, name);
}

module.exports = class EntryOptionPlugin {
	apply(compiler) {
    // 注册entry-option事件回调
		compiler.plugin("entry-option", (context, entry) => {
      // 在这里加载 SingleEntryPlugin 或者 MultiEntryPlugin 插件
			if(typeof entry === "string" || Array.isArray(entry)) {
				compiler.apply(itemToPlugin(context, entry, "main"));
			} else if(typeof entry === "object") {
				Object.keys(entry).forEach(name => compiler.apply(itemToPlugin(context, entry[name], name)));
			} else if(typeof entry === "function") {
        // 如果entry字段是一个函数，则加载 DynamicEntryPlugin 插件
				compiler.apply(new DynamicEntryPlugin(context, entry));
			}
			return true;
		});
	}
};
```
EntryOptionPlugin内根据webpack config对象的entry选项是否为数组来加载**MultiEntryPlugin或者SingleEntryPlugin**，如果是entry是函数则加载**DynamicEntryPlugin**。这三个插件都在compiler对象上注册了make事件钩子，并在该回调事件内调用了**compilation.addEntry**方法，这个方法是**webpack加载入口文件并且递归解析加载依赖module的开始**。
下面我们以SingleEntryPlugin为例：
```javascript
// webpack/lib/SingleEntryPlugin.js文件内
class SingleEntryPlugin {
  constructor(context, entry, name) {
    this.context = context;
    this.entry = entry;
    this.name = name;
  }

  apply(compiler) {
    compiler.plugin("compilation", (compilation, params) => {
      const normalModuleFactory = params.normalModuleFactory;

      compilation.dependencyFactories.set(SingleEntryDependency, normalModuleFactory);
    });
    // NOTE: 注册make事件钩子，这个事件会在 compiler.compile方法内触发。
    compiler.plugin("make", (compilation, callback) => {
      const dep = SingleEntryPlugin.createDependency(this.entry, this.name);
      // NOTE: 关键方法：调用 compilation.addEntry 方法，从这个方法开始加载入口文件，并且递归解析加载依赖module
      compilation.addEntry(this.context, dep, this.name, callback);
    });
  }

  static createDependency(entry, name) {
    const dep = new SingleEntryDependency(entry);
    dep.loc = name;
    return dep;
  }
}
```
现在从深入WebpackOptionsApply类的process方法回到webpack方法中。再来聊一下Compiler这个对象以及Compiler.run方法。   
**Compiler对象**是webpack编译过程中非常重要的一个对象。它代表的是配置完备的Webpack环境。compiler对象只在Webpack启动时构建一次，由Webpack组合所有的配置项构建生成。Compiler 继承自Tapable类，借助继承的Tapable类，Compiler具备有被注册监听事件，以及发射事件触发hook的功能，webpack的插件机制也由此形成。大多数面向用户的插件，都是首先在 Compiler 上注册的。   
插件注册，可见下面的[*一些细节章节的插件注册*](#插件注册)。这里不再赘述。    
Compiler对象的介绍，也可见下面的[*一些细节章节的Compiler对象*](#Compiler类)。这里不再赘述。  
Tapable类的介绍，可见下面的[*一些细节章节的Tapable类*](#Tapable类)。       
webpack的编译构建流程，由compiler.run()开始进入
```javascript
// webpack/lin/Complier.js文件内
/**
* @description 由该方法开始进入webpack编译流程
* @param {*} callback 编译完成后回调函数
* @memberof Compiler
* @file webpack/lin/Complier.js
*/
run(callback) {
  const startTime = Date.now();

  // 定义compile后的回调函数
  const onCompiled = (err, compilation) => {
    ...
    return callback();
  };

  // 触发before-run事件（compiler生命周期事件）
  // 具体参考：https://webpack.js.org/api/compiler-hooks/
  this.applyPluginsAsync("before-run", this, err => {
    if(err) return callback(err);
    // 触发run事件（compiler生命周期事件）
    this.applyPluginsAsync("run", this, err => {
      if(err) return callback(err);

      this.readRecords(err => {
        if(err) return callback(err);
        // NOTE: 关键方法：在此键入具体的编译构建流程
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

### Tapable类
Tapable类提供事件注册以及事件触发的能力（发布订阅模式模式中的Publisher对象，提供自定义事件注册和触发功能）。Compiler类和Compilation类都通过继承Tapable类来实现自己的生命周期事件的触发。所以webpack基于事件流的插件机制就源于此。

Tapable实例内部维护一个**_plugins**对象，作为事件注册的保存对象。同时提供以下重要方法：
* plugin(name: string, fn: function): void // 注册事件以及事件回调钩子，类似于 addEventListener(name, fn);
* applyPlugins**(name: string, params...): void // 以applyPlugins开头的一系列方法，用于触发指定事件
* apply(...plugins): void // 该方法接受任意个Plugin实例，并逐一调用Plugin实例的apply方法。并传入当前Tapable类实例。

Tapable中定义applyPlugin**的方法簇，用来触发指定自定义事件，并且以不同的方式来调用注册监听的handlers（同步或异步的调用handler），影响了handlers的传入参数（主要是handler传入的第一个参数和最后一个参数，以及参数的数量）、实现方式（handler是否会接受一个next参数来显示调用下一个handler）、 handlers链条的处理方式（handler能否中断下一个handler的调用）。比如applyPlugins方法会同步地按顺序地回调所有监听事件的handler，而applyPluginsAsyncSeries则依赖于每一个handler显示地调用next函数来对下一个handler进行调用。

因为Tapable中有如此多的**applyPlugin\*\***方法来触发自定义事件，所以webpack的**哪些生命周期事件由哪个具体的applyPlugin\*\* 方法触发**，就变得额外关键，因为这**决定了这个生命周期事件拥有哪些特性**，以及插件在注册指定的webpack的生命周期事件handler时，要如何具体的实现这个handler。
在 https://webpack-v3.jsx.app/Sapi/compiler/#event-hooks 中可以查到Compiler的每个具体的生命周期事件属于哪种类型，进而在实现响应的handler时，可以明确handler的参数传入和实现方式。
同样的，在  https://webpack-v3.jsx.app/api/compilation/ 可以查看到compilation对象的所有生命周期

关于Tapable类的更详细介绍，可以参考 [Webpack 源码（一）—— Tapable 和 事件流](https://segmentfault.com/a/1190000008060440#articleHeader6) 或者 [直接查看Tapable的源码注释](https://github.com/aasailan/learnWebpack/blob/master/debug_node_modules/tapable/lib/Tapable.js)。

比较有意思的是，由于compiler类和compilation类都继承了Tapable类。所以在Tapable类上添加log方法，再运行webpack，就可以很方便的得知webpack整个生命周期中事件的注册和触发顺序。关于这点，在本项目的debug_node_modules/tapable文件夹中的Tapable类已经添加log方法，只要在webstorm中debug build/webstorm-debugger.js文件，即可看到输出，输出如下：
```
事件注册: Compiler plugin: before-run
事件触发: Compiler applyPlugins: environment handlerNum: 0
事件触发: Compiler applyPlugins: after-environment handlerNum: 0
插件注册: Compiler registerPlugin: JsonpTemplatePlugin, FunctionModulePlugin, NodeSourcePlugin, LoaderTargetPlugin
事件注册: Compiler plugin: this-compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: after-resolvers
事件注册: Compiler plugin: compilation
插件注册: Compiler registerPlugin: EntryOptionPlugin
事件注册: Compiler plugin: entry-option
事件触发: Compiler applyPluginsBailResult: entry-option handlerNum: 1 NOTE: 根据webpack config的entry选项来注册SingleEntryPlugin、MultiEntryPlugin或者DynamicEntryPlugin插件
插件注册: Compiler registerPlugin: SingleEntryPlugin // NOTE: 该插件在compiler上注册了make事件handler，在这个handler中调用了compilation.addEntry()方法，从这个方法开始加载入口文件，并且递归解析加载依赖module
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: make
插件注册: Compiler registerPlugin: CompatibilityPlugin, HarmonyModulesPlugin, AMDPlugin, CommonJsPlugin, LoaderPlugin, NodeStuffPlugin, RequireJsStuffPlugin, APIPlugin, ConstPlugin, UseStrictPlugin, RequireIncludePlugin, RequireEnsurePlugin, RequireContextPlugin, ImportPlugin, SystemPlugin
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: after-resolvers
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
插件注册: Compiler registerPlugin: EnsureChunkConditionsPlugin, RemoveParentModulesPlugin, RemoveEmptyChunksPlugin, MergeDuplicateChunksPlugin, FlagIncludedChunksPlugin, OccurrenceOrderPlugin, FlagDependencyExportsPlugin, FlagDependencyUsagePlugin
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
事件注册: Compiler plugin: compilation
插件注册: Compiler registerPlugin: SizeLimitsPlugin
事件注册: Compiler plugin: after-emit
插件注册: Compiler registerPlugin: TemplatedPathPlugin
事件注册: Compiler plugin: compilation
插件注册: Compiler registerPlugin: RecordIdsPlugin
事件注册: Compiler plugin: compilation
插件注册: Compiler registerPlugin: WarnCaseSensitiveModulesPlugin
事件注册: Compiler plugin: compilation
插件注册: Compiler registerPlugin: CachePlugin
事件注册: Compiler plugin: this-compilation
事件注册: Compiler plugin: watch-run
事件注册: Compiler plugin: run
事件注册: Compiler plugin: after-compile
事件触发: Compiler applyPlugins: after-plugins handlerNum: 0
事件触发: Compiler applyPlugins: after-resolvers handlerNum: 2
事件触发: Compiler applyPluginsAsyncSeries: before-run handlerNum: 1
事件触发: Compiler applyPluginsAsyncSeries: run handlerNum: 1 // NOTE: 关键事件节点 Before reading records
事件触发: Compiler applyPlugins: normal-module-factory handlerNum: 0
事件触发: Compiler applyPlugins: context-module-factory handlerNum: 0
事件触发: Compiler applyPluginsAsyncSeries: before-compile handlerNum: 0
事件触发: Compiler applyPlugins: compile handlerNum: 0 // NOTE: 关键事件节点 Compiler开始进入编译构建流程
事件触发: Compiler applyPlugins: this-compilation handlerNum: 2
事件注册: Compilation plugin: child-compiler
事件触发: Compiler applyPlugins: compilation handlerNum: 31 // NOTE: 关键事件节点 Compilation creation completed，留意到创建完Compilation对象后马上注册了许多事件
事件注册: Compilation plugin: normal-module-loader
事件注册: Compilation plugin: normal-module-loader
事件注册: Compilation plugin: optimize-chunks-basic
事件注册: Compilation plugin: optimize-extracted-chunks-basic
事件注册: Compilation plugin: optimize-chunks-basic
事件注册: Compilation plugin: optimize-extracted-chunks-basic
事件注册: Compilation plugin: optimize-chunks-basic
事件注册: Compilation plugin: optimize-extracted-chunks-basic
事件注册: Compilation plugin: optimize-chunks-basic
事件注册: Compilation plugin: optimize-chunk-ids
事件注册: Compilation plugin: optimize-module-order
事件注册: Compilation plugin: optimize-chunk-order
事件注册: Compilation plugin: finish-modules
事件注册: Compilation plugin: optimize-modules-advanced
事件注册: Compilation plugin: record-modules
事件注册: Compilation plugin: revive-modules
事件注册: Compilation plugin: record-chunks
事件注册: Compilation plugin: revive-chunks
事件注册: Compilation plugin: seal
事件触发: Compiler applyPluginsParallel: make handlerNum: 1 // NOTE: 关键事件节点 分析入口文件，创建文件对象，然后将具体的编译构建流程交给compilation对象处理
事件触发: Compilation applyPlugins1: build-module handlerNum: 0 // NOTE: 开始构建模块 TODO: 后续去了解下
事件触发: Compilation applyPlugins: normal-module-loader handlerNum: 2 // NOTE: 关键事件节点 this is where all the modules are loaded one by one, no dependencies are created yet
事件触发: Compilation applyPlugins1: succeed-module handlerNum: 0
事件触发: Compilation applyPlugins1: finish-modules handlerNum: 1
事件触发: Compilation applyPlugins0: seal handlerNum: 1 // NOTE: 封装构建结果
事件触发: Compilation applyPlugins0: optimize handlerNum: 0
事件触发: Compilation applyPluginsBailResult1: optimize-modules-basic handlerNum: 0
事件触发: Compilation applyPluginsBailResult1: optimize-modules handlerNum: 0
事件触发: Compilation applyPluginsBailResult1: optimize-modules-advanced handlerNum: 1
事件触发: Compilation applyPlugins1: after-optimize-modules handlerNum: 0
事件触发: Compilation applyPluginsBailResult1: optimize-chunks-basic handlerNum: 4
事件触发: Compilation applyPluginsBailResult1: optimize-chunks handlerNum: 0
事件触发: Compilation applyPluginsBailResult1: optimize-chunks-advanced handlerNum: 0
事件触发: Compilation applyPlugins1: after-optimize-chunks handlerNum: 0
事件触发: Compilation applyPluginsAsyncSeries: optimize-tree handlerNum: 0
事件触发: Compilation applyPlugins2: after-optimize-tree handlerNum: 0
事件触发: Compilation applyPluginsBailResult: optimize-chunk-modules-basic handlerNum: 0
事件触发: Compilation applyPluginsBailResult: optimize-chunk-modules handlerNum: 0
事件触发: Compilation applyPluginsBailResult: optimize-chunk-modules-advanced handlerNum: 0
事件触发: Compilation applyPlugins2: after-optimize-chunk-modules handlerNum: 0
事件触发: Compilation applyPluginsBailResult: should-record handlerNum: 0
事件触发: Compilation applyPlugins2: revive-modules handlerNum: 1
事件触发: Compilation applyPlugins1: optimize-module-order handlerNum: 1
事件触发: Compilation applyPlugins1: advanced-optimize-module-order handlerNum: 0
事件触发: Compilation applyPlugins1: before-module-ids handlerNum: 0
事件触发: Compilation applyPlugins1: module-ids handlerNum: 0
事件触发: Compilation applyPlugins1: optimize-module-ids handlerNum: 0
事件触发: Compilation applyPlugins1: after-optimize-module-ids handlerNum: 0
事件触发: Compilation applyPlugins2: revive-chunks handlerNum: 1
事件触发: Compilation applyPlugins1: optimize-chunk-order handlerNum: 1
事件触发: Compilation applyPlugins1: before-chunk-ids handlerNum: 0
事件触发: Compilation applyPlugins1: optimize-chunk-ids handlerNum: 1
事件触发: Compilation applyPlugins1: after-optimize-chunk-ids handlerNum: 0
事件触发: Compilation applyPlugins2: record-modules handlerNum: 1
事件触发: Compilation applyPlugins2: record-chunks handlerNum: 1
事件触发: Compilation applyPlugins0: before-hash handlerNum: 0
事件触发: Compilation applyPlugins2: chunk-hash handlerNum: 0
事件触发: Compilation applyPlugins0: after-hash handlerNum: 0
事件触发: Compilation applyPlugins1: record-hash handlerNum: 0
事件触发: Compilation applyPlugins0: before-module-assets handlerNum: 0
事件触发: Compilation applyPluginsBailResult: should-generate-chunk-assets handlerNum: 0
事件触发: Compilation applyPlugins0: before-chunk-assets handlerNum: 0
事件触发: Compilation applyPlugins2: chunk-asset handlerNum: 0
事件触发: Compilation applyPlugins1: additional-chunk-assets handlerNum: 0
事件触发: Compilation applyPlugins2: record handlerNum: 0
事件触发: Compilation applyPluginsAsyncSeries: additional-assets handlerNum: 0
事件触发: Compilation applyPluginsAsyncSeries: optimize-chunk-assets handlerNum: 0
事件触发: Compilation applyPlugins1: after-optimize-chunk-assets handlerNum: 0
事件触发: Compilation applyPluginsAsyncSeries: optimize-assets handlerNum: 0
事件触发: Compilation applyPlugins1: after-optimize-assets handlerNum: 0
事件触发: Compilation applyPluginsBailResult: need-additional-seal handlerNum: 0
事件触发: Compilation applyPluginsAsyncSeries: after-seal handlerNum: 0
事件触发: Compiler applyPluginsAsyncSeries: after-compile handlerNum: 1 // NOTE: 完成所有模块构建，结束编译过程
事件触发: Compiler applyPluginsBailResult: should-emit handlerNum: 0
事件触发: Compiler applyPluginsAsyncSeries: emit handlerNum: 0 // NOTE: Before emitting assets to output dir，插件修改assets的最后机会
事件触发: Compiler applyPluginsAsyncSeries1: after-emit handlerNum: 1 // NOTE: assets输出完成
事件触发: Compilation applyPluginsBailResult: need-additional-pass handlerNum: 0
事件触发: Compiler applyPlugins: done handlerNum: 0
```

### Compiler类
##### Compiler对象在整个webpack构建的生命周期中只存在一个实例，代表了webpack的配置完备的Webpack环境和webpack的编译过程。Compiler实例拥有完整的webpack配置对象，在webpack构建的过程中触发自己的生命周期。

Compiler对象只在Webpack启动时初始化一次，存在于webpack从启动到关闭的整个生命周期，代表了配置完备的Webpack环境和一次完整的编译过程。
Compiler 继承自Tapable类，借助继承的Tapable类，Compiler具备有被注册监听事件，以及发射事件触发hook的功能。Compiler会在构建的过程中触发生命周期事件，以此带动Plugins中注册的对应的handler函数进行具体的事件处理。
大多数面向用户的插件，都是首先在 Compiler 上注册的。值得注意的是，各种loader实际上也是在LoaderPlugin（内置插件）内被调用的，loader本质上是一个函数接受模块源文件作为输入，转换成浏览器适用的文件作为输出，而负责启动调用loader的正是LoaderPlugin

Compiler类中的compile方法非常重要，是着当前编译任务的开始。当Compiler类处于watch模式时，文件系统发生改变，则重新调用Compiler.compile方法重启一次编译任务（这是webpack-dev-server能在文件发生改变时自动重新编译的基础）

Compiler类的一些详细注释可[直接查看Compiler的源码注释](https://github.com/aasailan/learnWebpack/blob/master/debug_node_modules/webpack/lib/Compiler.js)。

Compiler完整的生命周期可参见：https://webpack-v3.jsx.app/api/compiler/#event-hooks

## webpack运行过程中一些重要的生命周期节点：
applyPluginsBailResult: entry-option handlerNum: 1 NOTE: 根据webpack config的entry选项来注册SingleEntryPlugin、MultiEntryPlugin或者DynamicEntryPlugin插件，这些插件在compiler上注册了make事件handler，在这个handler中调用了compilation.addEntry()方法，从这个方法开始加载入口文件，并且递归解析加载依赖module。

applyPlugins: compile handlerNum: 0 // NOTE: 关键事件节点 Compiler开始进入编译构建流程

applyPlugins: compilation handlerNum: 31 // NOTE: 关键事件节点 Compilation对象创建完毕，通过此事件对外传递Compilation对象，让订阅了此事件的插件有机会对Compilation对象进行事件注册或者初始化。

applyPluginsParallel: make handlerNum: 1 // NOTE: 关键事件节点 分析入口文件，创建文件对象，然后将具体的编译构建流程交给compilation对象处理

Compilation applyPlugins1: build-module handlerNum: 0 // NOTE: 开始构建模块 TODO: 后续去了解下

Compiler applyPluginsAsyncSeries: after-compile handlerNum: 1 // NOTE: 完成所有模块构建，结束编译过程

Compiler applyPluginsAsyncSeries: emit handlerNum: 0 // NOTE: Before emitting assets to output dir，插件修改assets的最后机会

Compiler applyPluginsAsyncSeries1: after-emit handlerNum: 1 // NOTE: assets输出完成

### Compilation类


## 未完待续...
