# webpack运行流程

## 关于webpack运行的总体流程，可以查看[webpack流程.pdf](https://github.com/aasailan/learnWebpack/blob/master/webpack流程.pdf)内的流程。以下是一些代码细节

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
插件注册，可见的[*一些细节章节的插件注册*](https://github.com/aasailan/learnWebpack/blob/master/README.md#插件注册)。这里不再赘述。    
Compiler对象的介绍，也可见的[*webpack重要对象的Compiler类*](https://github.com/aasailan/learnWebpack/blob/master/webpack重要对象#Compiler类)。这里不再赘述。  
Tapable类的介绍，可见下面的[*webpack重要对象的Tapable类*](https://github.com/aasailan/learnWebpack/blob/master/webpack重要对象#Tapable类)。       
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
