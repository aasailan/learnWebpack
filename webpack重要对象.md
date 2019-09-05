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

比较有意思的是，由于compiler类和compilation类都继承了Tapable类。所以在Tapable类上添加log方法，再运行webpack，就可以很方便的得知webpack整个生命周期中事件的注册和触发顺序。关于这点，在本项目的debug_node_modules/tapable文件夹中的Tapable类已经添加log方法，只要在webstorm中debug build/webstorm-debugger.js文件，即可看到输出，输出log可在[webpack生命周期log](https://github.com/aasailan/learnWebpack/blob/master/webpack生命周期log.md)中查看

### Compiler类
##### Compiler对象在整个webpack构建的生命周期中只存在一个实例，代表了webpack的配置完备的Webpack环境和webpack的编译过程。Compiler实例拥有完整的webpack配置对象，在webpack构建的过程中触发自己的生命周期。

Compiler对象只在Webpack启动时初始化一次，存在于webpack从启动到关闭的整个生命周期，代表了配置完备的Webpack环境和一次完整的编译过程。
Compiler 继承自Tapable类，借助继承的Tapable类，Compiler具备有被注册监听事件，以及发射事件触发hook的功能。Compiler会在构建的过程中触发生命周期事件，以此带动Plugins中注册的对应的handler函数进行具体的事件处理。
大多数面向用户的插件，都是首先在 Compiler 上注册事件监听的。值得注意的是，各种loader也是在Compiler运行的过程中被调用的（准确的说是Compilation实例的生命周期中，Compiler的生命周期包含了Compilation实例的生命周期）。loader本质上是一个**函数**，它接受**模块源文件作为输入**，转换成**浏览器适用的文件**作为输出。

Compiler类中的compile方法非常重要，是着当前编译任务的开始。当Compiler类处于watch模式时，文件系统发生改变，则重新调用Compiler.compile方法重启一次编译任务（这是webpack-dev-server能在文件发生改变时自动重新编译的基础）

Compiler类的一些详细注释可[直接查看Compiler的源码注释](https://github.com/aasailan/learnWebpack/blob/master/debug_node_modules/webpack/lib/Compiler.js)。

Compiler完整的生命周期可参见：https://webpack-v3.jsx.app/api/compiler/#event-hooks

### Compilation类
Compilation实例负责组织整个打包过程，包含了每个构建环节及输出环节所对应的方法。
Compilation实例内保存了当前打包过程的中的关键对象，比如module、chunk、assets等等。
Compilation类也是继承了Tapable类，拥有自己的生命周期，Compilation的生命周期具体操纵了module编译和chunk的生成过程。

Compilation类的一些详细注释可[直接查看Compilation的源码注释](https://github.com/aasailan/learnWebpack/blob/master/debug_node_modules/webpack/lib/Compilation.js)。

Compilation完整的生命周期可参见：https://webpack-v3.jsx.app/api/compilation/

### module对象
* module是webpack构建过程中**组织源码文件的核心对象**。module类是一个抽象类，有好几个不同的子类，NormalModule , MultiModule , ContextModule , DelegatedModule等。
* webpack在构建过程中遇到es的import语句、commonjs的require语句、amd的require语句、css/sass/less文件中的@import语句，url(...)文件引用、img标签中的src语句等都会将对应的引用文件封装成一个module对象。
* 这里的module对象可以是各式各样的文件（图片、json、html等等）。module对象**拥有关键build方法**，来事件对自身的编译构建，正是在这个方法内会**调用loader将一个non-js module转换成一个js module**，进而转换成ast，实现对module的分析。

js文件通常会生成NormalModule，NormalModule类的一些详细注释可[直接查看NormalModule的源码注释](https://github.com/aasailan/learnWebpack/blob/master/debug_node_modules/webpack/lib/NormalModule.js)。

Module类的一些详细注释可[直接查看Module的源码注释](https://github.com/aasailan/learnWebpack/blob/master/debug_node_modules/webpack/lib/Module.js)。

## What is a webpack Module
In contrast to Node.js modules, webpack modules can express their dependencies in a variety of ways. A few examples are:

An ES2015 import statement
A CommonJS require() statement
An AMD define and require statement
An @import statement inside of a css/sass/less file.
An image url in a stylesheet (url(...)) or html (<img src=...>) file.
webpack 1 requires a specific loader to convert ES2015 import, however this is possible out of the box via webpack 2

Supported Module Types
webpack supports modules written in a variety of languages and preprocessors, via loaders. Loaders describe to webpack how to process non-JavaScript modules and include these dependencies into your bundles. The webpack community has built loaders for a wide variety of popular languages and language processors, including: