# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Hugo Theme Stack 是一个卡片风格的 Hugo 主题,专为博客设计。这是一个 Hugo 主题项目,不是常规的 Web 应用,所有功能都围绕 Hugo 的模板系统和资源管道构建。

## 开发命令

### 本地开发服务器
```bash
./debug.sh
# 或等同于:
cd exampleSite && hugo server --gc --themesDir=../..
```
这会在 exampleSite 目录中启动开发服务器,主题位于上两级目录。

### 构建
```bash
cd exampleSite && hugo --gc --themesDir=../..
```

## 核心架构

### 目录结构
- `layouts/` - Hugo 模板文件
  - `_default/` - 基础布局模板 (baseof.html, list.html, single.html)
  - `partials/` - 可复用的模板片段,按功能组织 (article/, footer/, head/, sidebar/, widget/)
  - `shortcodes/` - Hugo shortcode 定义
- `assets/` - 需要处理的资源文件
  - `ts/` - TypeScript 源文件,由 Hugo Pipes 编译
  - `scss/` - SCSS 样式文件,由 Hugo Pipes 编译
  - `icons/` - SVG 图标
- `i18n/` - 国际化翻译文件 (支持 20+ 语言)
- `data/` - 数据文件 (如 external.yaml)
- `exampleSite/` - 示例站点,用于开发和演示

### 前端架构

#### TypeScript 模块系统
主入口: `assets/ts/main.ts`

核心模块:
- `colorScheme.ts` - 深色模式切换
- `menu.ts` - 响应式菜单
- `gallery.ts` - 图片画廊 (PhotoSwipe 集成)
- `search.tsx` - 搜索功能 (使用 JSX/TSX)
- `scrollspy.ts` - 目录滚动监听
- `smoothAnchors.ts` - 平滑锚点滚动
- `color.ts` - 颜色提取 (用于卡片渐变背景)

所有 TS 文件通过 Hugo Pipes 处理,配置在 `assets/jsconfig.json`。

#### SCSS 架构
主入口: `assets/scss/style.scss`

结构:
- `variables.scss` - 主题变量 (颜色、字体、间距)
- `breakpoints.scss` - 响应式断点
- `grid.scss` - 网格系统
- `partials/` - 组件样式 (menu, article, widgets, footer, sidebar, pagination)
- `partials/layout/` - 页面布局样式 (article, list, 404, search)
- `custom.scss` - 用户自定义样式

### Hugo 集成

#### 要求
- Hugo Extended 版本 >= 0.87.0
- Go 1.17+ (用于 Hugo 模块系统)

#### 模板层次
1. `layouts/_default/baseof.html` - 基础模板,定义整体 HTML 结构
2. `layouts/_default/list.html` - 列表页 (主页、归档、分类、标签)
3. `layouts/_default/single.html` - 单篇文章页
4. `layouts/404.html` - 404 错误页
5. Partials 通过 `{{ partial "name.html" . }}` 引入

#### 配置文件
- 主题配置: `hugo.yaml` (定义默认参数)
- 示例站点配置: `exampleSite/hugo.yaml` (展示所有可用选项)

主要配置区域:
- `params.sidebar` - 侧边栏设置 (头像、副标题)
- `params.article` - 文章设置 (目录、阅读时间、数学公式)
- `params.comments` - 评论系统集成 (Disqus, Utterances, Waline, Giscus 等)
- `params.widgets` - 小部件配置
- `params.colorScheme` - 颜色主题设置
- `params.imageProcessing` - 图片处理选项

#### i18n 系统
- 翻译文件位于 `i18n/*.yaml`
- 支持 RTL 语言 (如阿拉伯语)
- 在模板中使用 `{{ i18n "key" }}`

### 关键功能实现

#### 1. 深色模式
- 通过 `colorScheme.ts` 中的 `StackColorScheme` 类管理
- 状态存储在 localStorage
- 支持自动检测系统偏好

#### 2. 图片画廊
- 使用 PhotoSwipe 库
- 在 `gallery.ts` 中的 `StackGallery` 类实现
- 自动检测文章内容中的图片组

#### 3. 卡片渐变背景
- 使用 `color.ts` 中的 Vibrant.js 提取图片颜色
- 在 `main.ts` 中通过 IntersectionObserver 懒加载应用
- 缓存颜色数据以提高性能

#### 4. 搜索功能
- 实现在 `search.tsx` (使用 Preact)
- 基于 Fuse.js 进行模糊搜索
- 索引由 Hugo 生成

#### 5. 代码块复制
- 在 `main.ts` 中实现
- 使用 Clipboard API
- 自动为所有代码块添加复制按钮

## 开发约束

### 模板开发
- 使用 Hugo 的 Go template 语法
- 避免在模板中进行复杂逻辑,将其移至 partials
- 保持 i18n 键的一致性,在所有语言文件中定义

### 前端开发
- TypeScript 代码应当类型安全
- 保持模块化,每个功能独立文件
- CSS 类名使用 BEM 命名约定
- 新样式应添加到相应的 partial,而非直接修改 `style.scss`

### 性能考虑
- 使用 IntersectionObserver 实现懒加载
- 图片通过 Hugo 的图片处理管道优化
- JavaScript 模块按需加载

### 兼容性
- 主题需要 Hugo Extended (支持 SCSS 处理)
- 浏览器兼容性: 现代浏览器 (ES2020+ 特性)
- TypeScript 编译目标: ES2020 (见 `jsconfig.json`)

## Hugo Pipes 资源处理

Hugo 会自动处理:
- `assets/ts/*.ts` → 编译为 JavaScript 并打包
- `assets/scss/*.scss` → 编译为 CSS
- 图片资源 → 根据配置调整大小和优化

不需要单独的构建工具 (无 npm scripts, webpack, vite 等)。

## 测试和部署

### Netlify 部署
配置在 `netlify.toml`:
- Hugo 版本: 0.152.2
- 构建命令: `cd exampleSite && hugo --gc --themesDir ../.. -b ${URL}`
- 发布目录: `exampleSite/public`
- 使用 netlify-plugin-hugo-cache-resources 插件

### 版本发布
- 主题使用 Go 模块版本化 (v3)
- 模块路径: `github.com/CaiJimmy/hugo-theme-stack/v3`

## 许可证

GPL-3.0-only - 修改主题时必须保留 "Theme Stack designed by Jimmy" 的版权信息。
