# Hugo Theme Stack - 侧边栏 Widget 系统深度分析

## 目录
1. [Widget 系统架构](#widget-系统架构)
2. [现有 Widget 实现详解](#现有-widget-实现详解)
3. [分类功能实现](#分类功能实现)
4. [样式系统](#样式系统)
5. [前端交互](#前端交互)
6. [配置系统](#配置系统)
7. [最佳实践建议](#最佳实践建议)

---

## Widget 系统架构

### 1. 核心工作原理

Widget 系统是一个**动态模板加载机制**，通过以下方式工作：

```
配置文件 (hugo.yaml)
    ↓
params.widgets (按作用域分类)
    ↓
右侧边栏模板 (sidebar/right.html)
    ↓
动态检查并加载 widget 模板
    ↓
渲染 HTML + 样式
```

### 2. Widget 配置示例（exampleSite/hugo.yaml）

```yaml
params:
  widgets:
    homepage:                    # 主页作用域
      - type: search            # widget 类型
      - type: archives
        params:
          limit: 5              # widget 参数
      - type: categories
        params:
          limit: 10
      - type: tag-cloud
        params:
          limit: 10
    page:                        # 文章页面作用域
      - type: toc               # 目录 widget
```

### 3. 右侧边栏渲染逻辑（layouts/partials/sidebar/right.html）

```html
{{- $scope := default "homepage" .Scope -}}
{{- $context := .Context -}}
{{- with (index .Context.Site.Params.widgets $scope) -}}
    <aside class="sidebar right-sidebar sticky">
        {{ range $widget := . }}
            {{ if templates.Exists (printf "partials/widget/%s.html" .type) }}
                {{- $params := default dict .params -}}
                {{ partial (printf "widget/%s" .type) (dict "Context" $context "Params" $params) }}
            {{ else }}
                {{ warnf "Widget %s not found" .type }}
            {{ end }}
        {{ end }}
    </aside>
{{ end }}
```

**关键点：**
- 获取当前作用域（homepage/page）
- 遍历该作用域的 widget 列表
- 使用 `templates.Exists()` 动态检查 widget 模板是否存在
- 将上下文（Context）和参数（Params）传递给 widget
- 如果 widget 不存在，记录警告日志

### 4. Widget 模板传入的上下文对象

每个 widget 接收的数据结构为：
```go
{
  "Context": Page,        // 当前页面对象，包含 .Site, .Title 等
  "Params": dict         // widget 特定参数
}
```

在 widget 模板中访问数据：
```html
.Context                 // 当前页面
.Context.Site           // 站点对象
.Context.Site.Params    // 全局参数
.Params                 // widget 参数（如 limit）
.Params.limit          // 特定参数值
```

---

## 现有 Widget 实现详解

### 1. Search Widget（搜索）

**文件位置：** `/layouts/partials/widget/search.html`

**实现逻辑：**
```html
{{- $query := first 1 (where .Context.Site.Pages "Layout" "==" "search") -}}
{{- if $query -}}
    {{- $searchPage := index $query 0 -}}
    <form action="{{ $searchPage.RelPermalink }}" class="search-form widget" 
          {{ with .OutputFormats.Get "json" -}}data-json="{{ .Permalink }}" {{- end }}>
        <p>
            <label>{{ T "search.title" }}</label>
            <input name="keyword" required placeholder="{{ T `search.placeholder` }}" />
            <button title="{{ T `search.title` }}">
                {{ partial "helper/icon" "search" }}
            </button>
        </p>
    </form>
{{- else -}}
    {{- warnf "Search page not found. Create a page with layout: search." -}}
{{- end -}}
```

**关键特点：**
- 查找 layout 为 "search" 的页面
- 绑定表单到搜索页面 URL
- 无需参数配置
- 前端搜索功能由 `assets/ts/search.tsx` 实现

---

### 2. Archives Widget（归档）

**文件位置：** `/layouts/partials/widget/archives.html`

**实现逻辑：**
```html
{{- $query := first 1 (where .Context.Site.Pages "Layout" "==" "archives") -}}
{{- $context := .Context -}}
{{- $limit := default 5 .Params.limit -}}
{{- if $query -}}
    {{- $archivesPage := index $query 0 -}}
    <section class="widget archives">
        <div class="widget-icon">
            {{ partial "helper/icon" "infinity" }}
        </div>
        <h2 class="widget-title section-title">{{ T "widget.archives.title" }}</h2>

        {{/* 获取所有常规页面并过滤 */}}
        {{ $pages := where $context.Site.RegularPages "Type" "in" $context.Site.Params.mainSections }}
        {{ $notHidden := where $context.Site.RegularPages "Params.hidden" "!=" true }}
        {{ $filtered := ($pages | intersect $notHidden) }}
        
        {{/* 按年份分组 */}}
        {{ $archives := $filtered.GroupByDate "2006" }}
        
        <div class="widget-archive--list">
            {{ range $index, $item := first (add $limit 1) ($archives) }}
                {{- $id := lower (replace $item.Key " " "-") -}}
                <div class="archives-year">
                    <a href="{{ $archivesPage.RelPermalink }}#{{ $id }}">
                        {{ if eq $index $limit }}
                            <span class="year">{{ T "widget.archives.more" }}</span>
                        {{ else }}
                            <span class="year">{{ .Key }}</span>
                            <span class="count">{{ len $item.Pages }}</span>
                        {{ end }}
                    </a> 
                </div>
            {{ end }}
        </div>
    </section>
{{- end -}}
```

**关键特点：**
- 使用 `limit` 参数控制显示数量（默认 5）
- 按年份 (2006 格式) 分组文章
- 过滤隐藏文章和非主要部分
- 链接指向带有 hash 的归档页面以实现锚点定位
- 显示每年文章数量

---

### 3. Categories Widget（分类云）

**文件位置：** `/layouts/partials/widget/categories.html`

**实现逻辑：**
```html
{{- $context := .Context -}}
{{- $limit := default 10 .Params.limit -}}
<section class="widget tagCloud">
    <div class="widget-icon">
        {{ partial "helper/icon" "categories" }}
    </div>
    <h2 class="widget-title section-title">{{ T "widget.categoriesCloud.title" }}</h2>

    <div class="tagCloud-tags">
        {{ range first $limit $context.Site.Taxonomies.categories.ByCount }}
            <a href="{{ .Page.RelPermalink }}" class="font_size_{{ .Count }}">
                {{ .Page.Title }}
            </a>
        {{ end }}
    </div>
</section>
```

**关键特点：**
- 直接使用 Taxonomy 系统：`$context.Site.Taxonomies.categories.ByCount`
- 按分类数量排序显示
- 类名 `font_size_{{ .Count }}` 用于动态字体大小（CSS 需定义对应规则）
- 链接指向分类页面
- 无需专门查找分类页面（自动由 Hugo 生成）

---

### 4. Tag-Cloud Widget（标签云）

**文件位置：** `/layouts/partials/widget/tag-cloud.html`

**实现逻辑：**
```html
{{- $context := .Context -}}
{{- $limit := default 10 .Params.limit -}}
<section class="widget tagCloud">
    <div class="widget-icon">
        {{ partial "helper/icon" "tag" }}
    </div>
    <h2 class="widget-title section-title">{{ T "widget.tagCloud.title" }}</h2>

    <div class="tagCloud-tags">
        {{ range first $limit $context.Site.Taxonomies.tags.ByCount }}
            <a href="{{ .Page.RelPermalink }}">
                {{ .Page.Title }}
            </a>
        {{ end }}
    </div>
</section>
```

**关键特点：**
- 与 Categories Widget 结构相同，只是使用 `tags` 而非 `categories`
- 共享相同的样式类 `tagCloud` 和 `tagCloud-tags`

---

### 5. TOC Widget（目录）

**文件位置：** `/layouts/partials/widget/toc.html`

**实现逻辑：**
```html
{{ if (.Context.Scratch.Get "TOCEnabled") }}
    <section class="widget archives">
        <div class="widget-icon">
            {{ partial "helper/icon" "hash" }}
        </div>
        <h2 class="widget-title section-title">{{ T "article.tableOfContents" }}</h2>
        
        <div class="widget--toc">
            {{ .Context.TableOfContents }}
        </div>
    </section>
{{ end }}
```

**关键特点：**
- 仅在 `single.html` 中启用（页面作用域）
- 基于 `TOCEnabled` 状态（在 single.html 中通过 Scratch 设置）
- 只有目录不为空时才显示
- 无参数配置

---

## 分类功能实现

### 1. Hugo 分类系统原理

Hugo 自动为 categories taxonomy 生成：
- **分类页面列表：** `/categories/` （显示所有分类）
- **单个分类页面：** `/categories/技术/` （显示该分类的所有文章）

这些页面使用 `layouts/_default/list.html` 模板。

### 2. 分类页面的布局（layouts/_default/list.html）

```html
{{ define "main" }}
    <header>
        <h3 class="section-title">
            {{ if eq .Parent (.GetPage "/") }}
                {{ T "list.section" }}
            {{ else }}
                {{ .Parent.Title }}
            {{ end }}
        </h3>

        <div class="section-card">
            <div class="section-details">
                <h3 class="section-count">{{ T "list.page" (len .Pages) }}</h3>
                <h1 class="section-term">{{ .Title }}</h1>
                {{ with .Params.description }}
                    <h2 class="section-description">{{ . }}</h2>
                {{ end }}
            </div>
            {{- $image := partialCached "helper/image" (dict "Context" . "Type" "section") .RelPermalink "section" -}}
            {{ if $image.exists }}
                <!-- 显示分类封面图 -->
            {{ end }}
        </div>
    </header>

    {{- $subsections := .Sections -}}
    {{- $pages := .Pages | complement $subsections -}}
    
    {{- if eq (len $pages) 0 -}}
        {{/* 如果没有普通页面，用列表样式显示子分类 */}}
        {{- $pages = $subsections -}}
        {{- $subsections = slice -}}
    {{- end -}}

    {{- with $subsections -}}
        <aside>
            <h2 class="section-title">{{ T "list.subsection" (len $subsections) }}</h2>
            <div class="subsection-list">
                <div class="article-list--tile">
                    {{ range . }}
                        {{ partial "article-list/tile" (dict "context" . "size" "250x150" "Type" "section") }}
                    {{ end }}
                </div>
            </div>
        </aside>
    {{- end -}}
    
    {{/* 列出该分类的所有文章 */}}
    {{ $paginator := .Paginate $pages }}
    <section class="article-list--compact">
        {{ range $paginator.Pages }}
            {{ partial "article-list/compact" . }}
        {{ end }}
    </section>

    {{- partial "pagination.html" . -}}
    {{ partialCached "footer/footer" . }}
{{ end }}

{{ define "right-sidebar" }}
    {{ partial "sidebar/right.html" (dict "Context" . "Scope" "homepage") }}
{{ end }}
```

**关键点：**
- 显示分类标题和文章数量
- 显示分类的可选描述
- 支持分类封面图片
- 列出该分类下的所有文章，带分页

### 3. 归档页面（layouts/_default/archives.html）

```html
{{ define "main" }}
    <header>
        {{- $taxonomy := $.Site.GetPage "taxonomyTerm" "categories" -}}
        {{- $terms := $taxonomy.Pages -}}
        {{ if $terms }}
        <h2 class="section-title">{{ T "widget.categoriesCloud.title" }}</h2>
        <div class="subsection-list">
            <div class="article-list--tile">
                {{ range $terms }}
                    {{ partial "article-list/tile" (dict "context" . "size" "250x150" "Type" "taxonomy") }}
                {{ end }}
            </div>
        </div>
        {{ end }}
    </header>

    {{ $pages := where .Site.RegularPages "Type" "in" .Site.Params.mainSections }}
    {{ $notHidden := where .Site.RegularPages "Params.hidden" "!=" true }}
    {{ $filtered := ($pages | intersect $notHidden) }}

    {{ range $filtered.GroupByDate "2006" }}
    {{ $id := lower (replace .Key " " "-") }}
    <div class="archives-group" id="{{ $id }}">
        <h2 class="archives-date section-title"><a href="{{ $.RelPermalink }}#{{ $id }}">{{ .Key }}</a></h2>
        <div class="article-list--compact">
            {{ range .Pages }}
                {{ partial "article-list/compact" . }}
            {{ end }}
        </div>
    </div>
    {{ end }}

    {{ partialCached "footer/footer" . }}
{{ end }}
```

---

## 样式系统

### 1. Widget 通用样式（assets/scss/partials/widgets.scss）

```scss
.widget {
    display: flex;
    flex-direction: column;

    .widget-icon {
        svg {
            width: 32px;
            height: 32px;
            stroke-width: 1.6;
            color: var(--body-text-color);
        }
    }
}
```

### 2. 标签云样式

```scss
.tagCloud {
    .tagCloud-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;

        a {
            background: var(--card-background);
            box-shadow: var(--shadow-l1);
            border-radius: var(--tag-border-radius);
            padding: 8px 20px;
            color: var(--card-text-color-main);
            font-size: 1.4rem;
            transition: box-shadow 0.3s ease;

            &:hover {
                box-shadow: var(--shadow-l2);
            }
        }
    }
}
```

### 3. 归档样式

```scss
.widget.archives {
    .widget-archive--list {
        border-radius: var(--card-border-radius);
        box-shadow: var(--shadow-l1);
        background-color: var(--card-background);
    }

    .archives-year {
        &:not(:last-of-type) {
            border-bottom: 1.5px solid var(--card-separator-color);
        }

        a {
            font-size: 1.4rem;
            padding: 18px 25px;
            display: flex;

            span.year {
                flex: 1;
                color: var(--card-text-color-main);
                font-weight: bold;
            }

            span.count {
                color: var(--card-text-color-tertiary);
            }
        }
    }
}
```

### 4. 响应式设计

右侧边栏在移动端隐藏：

```scss
.right-sidebar {
    width: 100%;
    display: none;
    flex-direction: column;
    gap: var(--widget-separation);

    @include respond(lg) {
        padding-top: var(--main-top-padding);
        padding-bottom: var(--main-top-padding);
    }
}
```

### 5. CSS 变量（assets/scss/variables.scss）

```scss
:root {
    --widget-separation: var(--section-separation);  // 40px
    --card-background: #fff;
    --card-text-color-main: #000;
    --card-text-color-tertiary: #767676;
    --shadow-l1: 0px 4px 8px rgba(0, 0, 0, 0.04), ...;
    --shadow-l2: 0px 10px 20px rgba(0, 0, 0, 0.04), ...;
    --tag-border-radius: 4px;
    --card-border-radius: 10px;
}
```

---

## 前端交互

### 1. 图标系统（layouts/partials/helper/icon.html）

```html
{{- $iconFile := resources.GetMatch (printf "icons/%s.svg" .) -}}
{{- if $iconFile -}}
    {{- $iconFile.Content | safeHTML -}}
{{- else -}}
    {{- errorf "Error: icon '%s.svg' is not found under 'assets/icons' folder" . -}}
{{- end -}}
```

**可用的 Widget 图标：**
- `infinity` - Archives widget
- `categories` - Categories widget
- `tag` - Tag-cloud widget
- `hash` - TOC widget
- `search` - Search widget

**图标文件位置：** `/assets/icons/*.svg`

### 2. i18n 国际化（i18n/en.yaml）

```yaml
widget:
  archives:
    title:
      other: Archives
    more:
      other: More
  
  tagCloud:
    title:
      other: Tags
  
  categoriesCloud:
    title:
      other: Categories

search:
  title:
    other: Search
  placeholder:
    other: Type something...
```

### 3. 前端 JavaScript（assets/ts/main.ts）

Widget 本身不需要特殊的 JavaScript，但以下功能由主 JavaScript 处理：
- 菜单切换
- 深色模式切换
- 图片库初始化
- 平滑锚点滚动
- 目录滚动监听

---

## 配置系统

### 1. 全局配置（hugo.yaml）

```yaml
params:
  mainSections:        # 主要内容部分（用于 archives 和分类）
    - post

  widgets:
    homepage:         # 主页 widget 列表
      - type: search
      - type: archives
        params:
          limit: 5
    
    page:            # 文章页 widget 列表
      - type: toc
```

### 2. Widget 参数传递

在配置中定义参数：
```yaml
- type: archives
  params:
    limit: 10
```

在模板中访问：
```html
{{- $limit := default 5 .Params.limit -}}
```

### 3. 作用域（Scope）

Widget 可为不同页面类型配置：
- `homepage` - 主页和分类列表页
- `page` - 文章内容页面
- 可自定义其他作用域

### 4. 在列表页面中指定作用域

```html
{{ define "right-sidebar" }}
    {{ partial "sidebar/right.html" (dict "Context" . "Scope" "homepage") }}
{{ end }}
```

---

## 最佳实践建议

### 1. 创建新 Widget 时的标准结构

```html
{{- $context := .Context -}}
{{- $limit := default 10 .Params.limit -}}

<section class="widget widgetName">
    <div class="widget-icon">
        {{ partial "helper/icon" "icon-name" }}
    </div>
    <h2 class="widget-title section-title">{{ T "widget.widgetName.title" }}</h2>
    
    <div class="widget-content">
        <!-- widget 特定的内容 -->
    </div>
</section>
```

### 2. CSS 类命名约定

- `.widget` - widget 容器
- `.widget-icon` - icon 容器
- `.widget-title` - 标题
- `.widget-[name]` - 特定 widget 样式前缀
- `.widget-[name]--list` - 列表容器（如 `widget-archive--list`）

### 3. 参数化配置

始终为可配置的值提供默认值：
```html
{{- $limit := default 10 .Params.limit -}}
{{- $showCount := default true .Params.showCount -}}
```

### 4. i18n 字符串

为所有用户可见的文本使用 i18n：
```html
<h2>{{ T "widget.mywidget.title" }}</h2>
```

并在 `i18n/*.yaml` 中添加：
```yaml
widget:
  mywidget:
    title:
      other: My Widget
```

### 5. 错误处理

像 search 和 archives widget 一样，验证所需资源：
```html
{{- $query := first 1 (where .Context.Site.Pages "Layout" "==" "search") -}}
{{- if $query -}}
    <!-- 渲染 widget -->
{{- else -}}
    {{- warnf "Search page not found" -}}
{{- end -}}
```

### 6. 性能考虑

- 使用 `first` 限制显示数量
- 使用 `where` 过滤不必要的页面
- 利用 `partialCached` 缓存重复渲染（如果 widget 不依赖页面特定变量）

### 7. 响应式设计

- 在右侧边栏上，使用移动端友好的布局
- 考虑不同屏幕尺寸的链接大小
- 使用 CSS 变量确保深色模式兼容性

---

## 文件清单

### Widget 模板
- `/layouts/partials/widget/search.html` - 搜索
- `/layouts/partials/widget/archives.html` - 归档
- `/layouts/partials/widget/categories.html` - 分类云
- `/layouts/partials/widget/tag-cloud.html` - 标签云
- `/layouts/partials/widget/toc.html` - 目录

### 侧边栏
- `/layouts/partials/sidebar/left.html` - 左侧边栏（菜单、头像）
- `/layouts/partials/sidebar/right.html` - 右侧边栏（widget 容器）

### 样式
- `/assets/scss/partials/widgets.scss` - Widget 样式
- `/assets/scss/partials/sidebar.scss` - 侧边栏样式
- `/assets/scss/variables.scss` - CSS 变量定义

### 国际化
- `/i18n/en.yaml` - 英文翻译
- 其他语言：`/i18n/{language}.yaml`

### 页面布局
- `/layouts/_default/list.html` - 分类/标签列表页
- `/layouts/_default/archives.html` - 归档页
- `/layouts/index.html` - 主页
- `/layouts/_default/single.html` - 文章页面

### 辅助
- `/layouts/partials/helper/icon.html` - Icon 加载器
- `/assets/icons/*.svg` - SVG 图标文件

