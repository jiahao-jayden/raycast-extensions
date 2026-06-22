# Quick Secret Saver — Raycast Extension 设计文档

日期: 2026-06-12
状态: 已确认,待实现

## 1. 背景与目标

用户日常需要临时保存一些文本信息(账号、密码、临时 token、地址、备注等),这些信息经常"丢来丢去"难以管理。本扩展提供一个 Raycast 插件,让用户能**快速保存**和**快速取用**这些文本片段。

核心诉求:存得快、找得到、别丢。这不是一个完整的密码管理器,而是一个轻量、顺手的文本片段保险箱。

### 成功标准

- 复制了一段文本后,能在数秒内通过一个命令把它存下来(只需补一个标题)。
- 需要某条信息时,能通过搜索快速定位并一键复制到剪贴板。
- 数据加密落盘,不以明文形式暴露在普通文件中。
- 支持对已存条目的查看、编辑、删除。

## 2. 范围

### 包含

- 手动新建条目(标题 + 自由文本内容)。
- 从剪贴板快速保存(自动预填内容,补标题即存)。
- 搜索 + 一键复制 + 查看详情 + 编辑 + 删除。
- 基于 Raycast 加密本地存储的单机持久化。
- 数据层抽象为可替换的存储接口,为未来同步预留扩展点。

### 不包含(YAGNI)

- 跨设备同步(本期不做;数据层接口为其预留,见 §7)。
- 结构化字段(用户名/密码分离)、标签/分类。
- 主密码二次解锁。
- 剪贴板自动捕获/监听(无独立的后台捕获命令)。

## 3. 安全模型

数据通过 Raycast 的 `LocalStorage` API 持久化。该 API 由 Raycast 管理,数据存于其**本地加密数据库**(加密落盘),同一扩展内的所有命令共享访问,扩展之间互相隔离。

固有取舍(已与用户确认):

- 读取时**无需二次解锁** —— 当 Mac 已登录且 Raycast 运行时,任何能操作该用户 Raycast 的人都可读取这些内容。这是为了换取"快速存取"体验而接受的代价。
- 数据**仅存于本机**(`LocalStorage` 不随 Raycast Cloud Sync 跨设备同步)。

注意事项:

- 内容可能含敏感信息(密码、token),错误提示与日志中**不得回显内容明文**,只引用标题或条目 id。

## 4. 架构

三个 Raycast 命令构成 UI 层,共用一个数据层。

```
commands (save / save-from-clipboard / search)   ← UI 层:界面与交互
        │
        ▼
   storage 模块 (SecretStore 接口)                ← 数据层:封装所有读写
        │
        ▼
   LocalStorage (Raycast 加密本地存储)             ← 当前实现
```

命令层只依赖 `SecretStore` 接口,不直接触碰 `LocalStorage`。当前实现为基于 `LocalStorage` 的 `LocalSecretStore`;未来若加同步,只需新增实现,命令层不变(见 §7)。

### 命令清单

| 命令 | 模式 | 作用 |
|------|------|------|
| Save Secret | view (表单) | 手动新建:填标题 + 内容,回车保存 |
| Save from Clipboard | view (表单) | 启动时读剪贴板预填内容,补标题即存 |
| Search Secrets | view (列表) | 搜索、复制、查看详情、编辑、删除 |

## 5. 数据模型

每条记录:

```ts
interface Secret {
  id: string;        // 唯一 id(crypto.randomUUID)
  title: string;     // 标题,非空
  content: string;   // 自由文本内容,可为空
  createdAt: number; // 创建时间戳 (ms)
  updatedAt: number; // 最后更新时间戳 (ms)
}
```

### 存储格式

`LocalStorage` 是 key-value 存储。全部记录以单个 key(`secrets`)序列化为 JSON 数组存放。个人使用量级下,整存整取足够简单可靠。

## 6. SecretStore 接口

数据层对外暴露的接口(命令层唯一依赖):

```ts
interface SecretStore {
  list(): Promise<Secret[]>;                                  // 全部记录,按 updatedAt 倒序
  get(id: string): Promise<Secret | undefined>;               // 单条
  save(input: { title: string; content: string }): Promise<Secret>;  // 新建,生成 id/时间戳
  update(id: string, patch: { title?: string; content?: string }): Promise<Secret>; // 更新并刷新 updatedAt
  remove(id: string): Promise<void>;                          // 删除
}
```

`LocalSecretStore` 为基于 `LocalStorage` 的实现。内部封装"读全量 → 改 → 写全量"的读改写循环及 JSON 序列化/反序列化。

## 7. 同步扩展点(本期不实现)

`SecretStore` 是一个接口而非具体类。未来若需跨设备同步,可新增实现(如基于私有 Gist / iCloud 文件 / 自建 API),命令层无需改动。本期仅交付 `LocalSecretStore`。此处不引入任何外部凭证或网络逻辑。

## 8. 数据流

- **手动保存**:表单提交 → 校验标题非空 → `store.save({title, content})` → Toast 成功 → 关闭窗口。
- **从剪贴板保存**:命令启动 `Clipboard.readText()` 预填内容(为空则提示但允许手填)→ 补标题 → 同保存路径。
- **查找**:启动 `store.list()` → 按 `updatedAt` 倒序展示 → 搜索框本地过滤(匹配标题 + 内容)→ 回车 `Clipboard.copy(content)` + Toast。
- **查看详情**:列表项快捷动作 → 展示完整内容(Detail 视图)。
- **编辑**:列表项快捷动作 → 表单(复用保存表单组件)→ `store.update` → 刷新列表。
- **删除**:列表项快捷动作 → 确认对话框 → `store.remove(id)` → 刷新列表。

### 列表项动作(Search Secrets)

| 动作 | 触发 | 行为 |
|------|------|------|
| Copy Content | 回车(主动作) | 复制内容到剪贴板 + Toast |
| Show Details | 快捷键 | 打开详情视图查看完整内容 |
| Edit | 快捷键 | 打开编辑表单 |
| Delete | 快捷键 | 确认后删除 |

## 9. 错误处理

- 所有 `store` 操作包裹 try/catch;失败时 `showToast`(红色 Failure)显示具体原因:读取失败、JSON 解析失败、写入失败。不静默吞错。
- UI 层前置校验:标题为空时阻止提交并提示;剪贴板为空时提示但不阻断手填。
- 错误信息与日志**只引用标题或 id,绝不回显内容明文**(见 §3)。
- JSON 解析失败时,不覆盖原始数据,向用户报错,避免数据丢失。

## 10. 测试策略

- **核心单元测试**:`LocalSecretStore` 的 `save / list / get / update / remove`,用内存版 mock 替换 `LocalStorage`。覆盖:新建生成 id/时间戳、更新刷新 updatedAt、删除、list 排序、JSON 解析失败的错误路径。
- **测试框架**:沿用 Raycast 扩展模板提供的配置(实现阶段确认模板默认的测试工具并按其约定接入)。
- **UI 命令层**:逻辑薄,主要通过 `npm run dev` 在 Raycast 中手动验证三条命令的交互。

## 11. 项目结构(预期)

```
raycast-plugin/
├── package.json          # Raycast manifest:三个命令的声明 + 依赖
├── src/
│   ├── save.tsx                 # Save Secret 命令
│   ├── save-from-clipboard.tsx  # Save from Clipboard 命令
│   ├── search.tsx               # Search Secrets 命令
│   ├── components/
│   │   └── secret-form.tsx      # 新建/编辑共用的表单组件
│   └── storage/
│       ├── types.ts             # Secret / SecretStore 接口
│       └── local-store.ts       # LocalSecretStore 实现
└── docs/superpowers/specs/      # 本设计文档
```

具体文件命名以 Raycast 模板脚手架生成的约定为准,实现阶段对齐。
