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