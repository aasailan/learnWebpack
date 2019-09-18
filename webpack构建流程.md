# webpack运行流程

## 关于webpack运行的总体流程，可以查看[webpack流程.pdf](https://github.com/aasailan/learnWebpack/blob/master/webpack流程.pdf)内的流程。以下是一些代码细节

## 1、shell options 与 webpack config的获取与合并
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


## 2、创建compiler对象，在compiler对象上加载必要插件，调用compiler.run方法开始进入编译过程
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
webpack是一个比较关键的函数，这个函数内**创建了compiler对象**，并且在**compiler对象上注册了用户在webpack config上配置好的所有插件**。同时这个文件还在webpack上添加了所有webpack内置的插件，比如我们常用的webpack.optimize.UglifyJsPlugin插件。
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
    // NOTE: 创建Compiler实例
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
上面源码中**WebpackOptionsApply类的process方法**非常重要。这个方法中对compiler注册了很多内置的插件。这些插件都比较关键，比如负责**注册make事件钩子的EntryOptionPlugin**等。这些插件在后面的构建生命周期中起到关键作用。
WebpackOptionsApply类的process如下：
```javascript
// webpack/lib/WebpackOptionsApply.js文件内
/**
* @description 根据webpack config对象对compiler添加一些必要属性，以及加载必要的插件
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
上述process方法中加载很多关键的插件，这里关注其中的**EntryOptionPlugin**。EntryOptionPlugin插件中又根据是否存在多个entry file，注册了**MultiEntryPlugin或者SingleEntryPlugin**，这两个插件会在compiler中**注册make回调钩子**，并在这个回调钩子中，调用compilation.addEntry方法开从入口文件解析并加载module。
以下是EntryOptionPlugin内的关键代码：
```javascript
// webpack/lib/EntryOptionPlugin.js文件内
function itemToPlugin(context, item, name) {
	if(Array.isArray(item)) {
    // NOTE: entry为数组时，多入口文件
		return new MultiEntryPlugin(context, item, name);
  }
  // NOTE: entry不为数组，单入口文件
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

## 3、调用Compiler.run，创建Compilation对象，然后出发关键的make生命周期事件，将具体的编译事项交给Compilation对象。

**Compiler对象**是webpack编译过程中非常重要的一个对象。它代表的是配置完备的Webpack环境。compiler对象只在Webpack启动时构建一次，由Webpack组合所有的配置项构建生成。Compiler 继承自Tapable类，借助继承的Tapable类，Compiler具备有被注册监听事件，以及发射事件触发hook的功能，webpack的插件机制也由此形成。大多数面向用户的插件，都是首先在 Compiler 上注册的。   
插件注册，可见的[*一些细节章节的插件注册*](https://github.com/aasailan/learnWebpack/blob/master/README.md#插件注册)。这里不再赘述。    
Compiler对象的介绍，也可见的[*webpack重要对象的Compiler类*](https://github.com/aasailan/learnWebpack/blob/master/webpack重要对象#Compiler类)。这里不再赘述。  
Tapable类的介绍，可见下面的[*webpack重要对象的Tapable类*](https://github.com/aasailan/learnWebpack/blob/master/webpack重要对象#Tapable类)。       
webpack的编译构建流程，由compiler.run()开始进入
```javascript
// webpack/lib/Complier.js文件内
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
    // NOTE: 此时已经完成了所有modules的构建，以及chunk和asset的生成
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
Compiler.compile方法内会创建出compilation对象，并且将具体的编译事项交给compilation。
```javascript
 /**
  * @description NOTE: 从这个方法开始具体的编译构建流程
  * 在compiler触发run事件后调用本方法。watch模式下每次文件发生改变
  * 都是通过调用本方法重启一次编译过程
  * @param {*} callback
  * @memberof Compiler
  */
  compile(callback) {
    const params = this.newCompilationParams();
    // 触发 before-compile 生命周期
		this.applyPluginsAsync("before-compile", params, err => {
			if(err) return callback(err);
      // NOTE: 触发compile 生命周期，Compiler进入编译构建阶段
			this.applyPlugins("compile", params);
      // NOTE: 创建关键的compilation实例
			const compilation = this.newCompilation(params);
      // NOTE: 触发make生命周期，然后将具体的编译构建流程交给compilation对象处理
			this.applyPluginsParallel("make", compilation, err => {
        if(err) return callback(err);
        
				compilation.finish();
        // NOTE: 关键方法：在seal方法内对编译完的chunk封装，并最后输出为bundle
				compilation.seal(err => {
					if(err) return callback(err);
          // NOTE: compile生命周期 完成所有模块构建，结束编译过程
					this.applyPluginsAsync("after-compile", compilation, err => {
						if(err) return callback(err);

						return callback(null, compilation);
					});
				});
			});
		});
	}
```

## 4、在make生命周期事件中，调用Compilation.addEntry方法，从entry file开始，递归的解析和build module.
在上述第二步中已经说过，EntryOptionPlugin插件内会根据entry的类型注册不同的*EntryPlugin。在*EntryPlugin中最重要的是在compiler上注册make事件处理函数。在该处理函数中会调用compilation.addEntry方法。
以下是SingleEntryPlugin插件的apply方法示例：
```javascript
// webpack/lib/SingleEntryPlugin.js文件内
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
```
从compilation.addEntry方法开始加载入口文件，并且递归解析加载依赖module
```javascript
/**
  * @description 从入口文件开始进行module的递归解析
  * @param {*} context
  * @param {string} entry
  * @param {*} name
  * @param {function} callback 该callback定义在Compiler.compile方法内，是make事件触发后的回调
  * @memberof Compilation
  */
 addEntry(context, entry, name, callback) {
		const slot = {
			name: name,
			module: null
		};
    this.preparedChunks.push(slot);
    
    // NOTE: _addModuleChain先调用buildModule()构建entry module，
    // 然后调用 processModuleDependencies()从entry module开始对其依赖的module进行 递归的编译。
		this._addModuleChain(context, entry, (module) => {
      // 得到入口文件对应的module对象并保存到compilation对象
      // 此时module对象还未进行构建
			entry.module = module;
			this.entries.push(module);
			module.issuer = null;

		}, (err, module) => {
      // 参数 module 为entry module对象
      // NOTE: 此时所有module已经构建处理完毕
			if(err) {
				return callback(err);
			}

			if(module) {
				slot.module = module;
			} else {
				const idx = this.preparedChunks.indexOf(slot);
				this.preparedChunks.splice(idx, 1);
      }
      // NOTE: 调用callback
      // 该callback定义在Compiler.compile方法内，是make事件触发后的回调
			return callback(null, module);
		});
	}
```
_addModuleChain先调用buildModule()构建entry module，然后调用 processModuleDependencies()从entry module开始对其依赖的module进行 递归的编译。其中所有module的编译都是通过compilation.buildModule方法来进行的，而buildModule方法内，又是通过调用module.build方法，来具体的完成module对象的编译过程。
```javascript
buildModule(module, optional, origin, dependencies, thisCallback) {
    // NOTE: 触发build-module事件，将当前module对象作为参数 Before a module build has started.
		this.applyPlugins1("build-module", module);
		if(module.building) return module.building.push(thisCallback);
		const building = module.building = [thisCallback];

		function callback(err) {
			module.building = undefined;
			building.forEach(cb => cb(err));
    }
    // NOTE: 调用module.build方法开始编译module
		module.build(this.options, this, this.resolvers.normal, this.inputFileSystem, (error) => {
      // module编译后的回调
      const errors = module.errors;
			for(let indexError = 0; indexError < errors.length; indexError++) {
				const err = errors[indexError];
				err.origin = origin;
				err.dependencies = dependencies;
				if(optional)
					this.warnings.push(err);
				else
					this.errors.push(err);
			}

			const warnings = module.warnings;
			for(let indexWarning = 0; indexWarning < warnings.length; indexWarning++) {
				const war = warnings[indexWarning];
				war.origin = origin;
				war.dependencies = dependencies;
				this.warnings.push(war);
			}
			module.dependencies.sort(Dependency.compare);
			if(error) {
				this.applyPlugins2("failed-module", module, error);
				return callback(error);
      }
      // NOTE: 成功构建当前module
			this.applyPlugins1("succeed-module", module);
			return callback();
		});
	}
```
module对象是webpack组织源码文件进行编译的核心对象，源码内符合webpack module规范的文件都会被封装成一个module对象。Module类只是一个抽象类，他有很多具体的实现子类，每一个子类都定义了各自的build方法。其中loader的调用就是在module.build中完成调用的。
module.build的运行大概过程如下图所示：
@import "./build module.png";

## 5、封装module，生成chunk对象，然后根据chunk对象生成最终的assets对象，进而生成静态资源文件
经过第四步，所有module对象都被递归的调用了module.build方法，每一个module都经过了loader（如果配置了的话）的处理，此时的module一定是一个js module，能被浏览器运行。此时调用compilation.seal方法，开始对module对象进行封装。
Compilation.seal方法是封装module的入口方法
```javascript
// webpack/lib/Compilation.js 内
	seal(callback) {
    // NOTE: The sealing of the compilation has started.此时所有module已经经过loader处理，并且被解析为ast树
		this.applyPlugins0("seal");
		this.nextFreeModuleIndex = 0;
    this.nextFreeModuleIndex2 = 0;
    
    // preparedChunks 内存储着entry chunk; 处理entry chunk
		this.preparedChunks.forEach(preparedChunk => {
      const module = preparedChunk.module;
      // NOTE: 生成一个chunk对象并且保存在compilation.chunks数组中；每个chunk对应一个输出文件。
			const chunk = this.addChunk(preparedChunk.name, module);
			const entrypoint = this.entrypoints[chunk.name] = new Entrypoint(chunk.name);
			entrypoint.unshiftChunk(chunk);

      // NOTE: 整理每个Module和chunk
			chunk.addModule(module);
			module.addChunk(chunk);
      chunk.entryModule = module;
      
			this.assignIndex(module);
			this.assignDepth(module);
    });
    
    // NOTE: 为所有的chunk和module相互添加联系; 当前chunks数组只有entry chunk; 代码分割产生的chunk在这个方法内生成
		this.processDependenciesBlocksForChunks(this.chunks.slice());
    this.sortModules(this.modules);

    // NOTE: 以下开始进入optimization阶段
    // webpack is begining the optimization phase
		this.applyPlugins0("optimize");
    ...
    // NOTE: 根据chunk生成assets
    this.createChunkAssets();
		...
	}
```
processDependenciesBlocksForChunks方法从entry chunk开始生成所有的
chunk(每个代码分割点生成一个chunk)。所有的chunk生成之后，触发一系列optimize(优化)相关的声明周期事
件，很多插件就是在这里对module、chunk进行优化操作(比如著名的 commonsChunkPlugins)。

所有的chunk对象都生成后，由createChunkAssets方法对每一个chunk对象进行处理，借助mainTemplate或者chunkTemplat的render方法来生成最终需要输出到文件内的代码。
```javascript
// webpack/lib/Compilation.js
// 根据chunk生成asset对象
	createChunkAssets() {
    const outputOptions = this.outputOptions;
		const filename = outputOptions.filename;
    const chunkFilename = outputOptions.chunkFilename;
    // NOTE: 逐一处理所有chunk，每个chunk都会生成一个assets
		for(let i = 0; i < this.chunks.length; i++) {
			const chunk = this.chunks[i];
			chunk.files = [];
			const chunkHash = chunk.hash;
			let source;
      let file;
      // chunk输出文件名模板
			const filenameTemplate = chunk.filenameTemplate ? chunk.filenameTemplate :
				chunk.isInitial() ? filename :
				chunkFilename;
			try {
				const useChunkHash = !chunk.hasRuntime() || (this.mainTemplate.useChunkHash && this.mainTemplate.useChunkHash(chunk));
				const usedHash = useChunkHash ? chunkHash : this.fullHash;
				const cacheName = "c" + chunk.id;
				if(this.cache && this.cache[cacheName] && this.cache[cacheName].hash === usedHash) {
					source = this.cache[cacheName].source;
				} else {
          // NOTE: source.children 属性是个数组，数组内每一个元素都是即将输出到文件的一行代码文本字符串
					if(chunk.hasRuntime()) {
            // entry chunk处理
            // NOTE: mainTemplate 生成的source包含了webpackBootstrap启动代码
						source = this.mainTemplate.render(this.hash, chunk, this.moduleTemplate, this.dependencyTemplates);
					} else {
            // non entry chunk处理
            // chunkTemplate打印的是普通的异步chunk
						source = this.chunkTemplate.render(chunk, this.moduleTemplate, this.dependencyTemplates);
          }
          // 把当前source对象缓存进this.cache对象
					if(this.cache) {
						this.cache[cacheName] = {
							hash: usedHash,
							source: source = (source instanceof CachedSource ? source : new CachedSource(source))
						};
					}
        }
        // 根据filenameTemplate获取输出的文件名
				file = this.getPath(filenameTemplate, {
					noChunkHash: !useChunkHash,
					chunk
				});
				if(this.assets[file])
          throw new Error(`Conflict: Multiple assets emit to the same filename ${file}`);
        // NOTE: 关键步骤，将source对象保存在compilation.assets，source.children属性保存了即将输出到assets中的每一行代码
				this.assets[file] = source;
        chunk.files.push(file);
        // 
				this.applyPlugins2("chunk-asset", chunk, file);
			} catch(err) {
				this.errors.push(new ChunkRenderError(chunk, file || filenameTemplate, err));
			}
		}
	}
```
上面生成source对像就是asset对象，器内部保存了最终需要输出到文件的js代码字符串。最后在compiler.emitAssets方法中，会将这些asset对象输出到文件系统形成静态文件
```javascript
 // NOTE: 根据assets生成静态文件
	emitAssets(compilation, callback) {
		let outputPath;

    // 生成静态文件函数
		const emitFiles = (err) => {
			if(err) return callback(err);

      // NOTE: 遍历每一个assets对象，生成对应文件
			require("async").forEach(Object.keys(compilation.assets), (file, callback) => {

				let targetFile = file;
				const queryStringIdx = targetFile.indexOf("?");
				if(queryStringIdx >= 0) {
					targetFile = targetFile.substr(0, queryStringIdx);
				}

        // 定义输出函数
				const writeOut = (err) => {
					if(err) return callback(err);
					const targetPath = this.outputFileSystem.join(outputPath, targetFile);
					const source = compilation.assets[file];
					if(source.existsAt === targetPath) {
            // 如果需要输出的文件已经存在，则不再生成
						source.emitted = false;
						return callback();
          }
          // NOTE: 从source对象获取到需要输出的代码
					let content = source.source();

					if(!Buffer.isBuffer(content)) {
						content = new Buffer(content, "utf8"); // eslint-disable-line
					}

					source.existsAt = targetPath;
          source.emitted = true;
          // NOTE: 将buffer流输出到文件
					this.outputFileSystem.writeFile(targetPath, content, callback);
				};

				if(targetFile.match(/\/|\\/)) {
					const dir = path.dirname(targetFile);
					this.outputFileSystem.mkdirp(this.outputFileSystem.join(outputPath, dir), writeOut);
				} else writeOut();

			}, err => {
				if(err) return callback(err);

				afterEmit.call(this);
			});
		};

    // NOTE: 重要生命周期，即将开始根据assets生成静态文件，生成静态文件前修改assets的最后机会
		this.applyPluginsAsync("emit", compilation, err => {
      if(err) return callback(err);
      // 获取静态文件输出路径
      outputPath = compilation.getPath(this.outputPath);
      // 创建静态文件输出路径文件夹，然后开始生成静态文件
			this.outputFileSystem.mkdirp(outputPath, emitFiles);
		});

		function afterEmit() {
			this.applyPluginsAsyncSeries1("after-emit", compilation, err => {
				if(err) return callback(err);

				return callback();
			});
		}

	}
```
至此，webpack的编译过程基本完结，源码文件经过 module -> chunk -> asset 一系列的转换，最终输出到文件系统成为静态资源文件。

