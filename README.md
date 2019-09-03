# learn webpack

本项目用于阅读学习webpack源码，项目基于webpack3.10.0版本。wepack源码以及注释放在debug_node_modules文件夹下。利用webstorm debug build文件夹下面的webstorm-debugger.js文件，可以debug debug_node_modules文件夹下面的webpack源码。

#### 由于当前webpack已经升级到webpack4，官方网站的文档已经切换到webpack4。webpack3的文档可在 https://webpack-v3.jsx.app/ 或者 https://github.com/webpack/webpack.js.org/blob/v3.11.0/src/content/index.md 中查看

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

## webpack内的一些重要对象解析
关于webpack内的一些重要对象解析可以查看[webpack重要对象](https://github.com/aasailan/learnWebpack/blob/master/webpack重要对象.md)

## webpack运行流程说明
关于webpack运行流程的说明可以查看[webpack构建流程](https://github.com/aasailan/learnWebpack/blob/master/webpack构建流程.md)

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