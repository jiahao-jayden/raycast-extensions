# Gist Sync — Quick Secret Saver 同步功能设计文档

日期: 2026-06-12
状态: 已确认,待实现
依赖: 基础插件(docs/superpowers/specs/2026-06-12-quick-secret-saver-design.md)已实现

## 1. 背景与目标

基础插件是单机的:秘密存在 Raycast 的本机加密 `LocalStorage`,换设备看不到(Raycast Cloud Sync 不含扩展 LocalStorage)。本功能新增一个手动同步命令,通过一个**私有 GitHub Gist** 作为中转,让多台设备共享同一份秘密。

核心诉求:换设备后能拿到全部秘密,且数据在离开本机时是加密的。

### 成功标准

- 在设备 A 保存的秘密,在设备 B 跑一次 Sync 后能看到。
- 上传到 GitHub 的内容是加密的;GitHub 或拿到 token 的人都读不到明文。
- 两台设备各自的改动同步后都不丢(按 id 合并,冲突取较新)。

## 2. 安全模型(已与用户确认)

- **上传前加密**:内容用用户口令经 AES-256-GCM 加密后才上传。Gist 里只有密文。口令绝不上传。
- **口令每次输入**:Sync 命令运行时弹密码框输入,用完不保留,仅在内存中短暂存在。口令丢失 = 数据无法恢复(可接受的取舍)。
- **token 存 Raycast preferences**:GitHub PAT(仅需 `gist` 权限)与 gist id 存在扩展 preferences,token 字段为 `password` 类型(Raycast 加密保存)。
- **不回显明文**:所有错误/Toast 只引用标题、id 或错误类型,绝不输出秘密内容或口令。

## 3. 范围

### 包含

- `Sync Secrets` 命令:拉取 → 解密 → 合并 → 写回本机 → 加密上传。
- 口令加密信封(AES-256-GCM + scrypt)。
- 按 id 的智能合并,冲突取 updatedAt 较新者。
- preferences:`githubToken`(password)、`gistId`(text)。

### 不包含(YAGNI)

- 自动后台同步(本功能为手动触发)。
- 软删除墓碑:删除只在本机生效,不跨设备传播(用户选 A)。换设备后被删条目可能从远端"复活",需在各设备手动再删。
- 自动创建 gist:首版要求用户先手动建一个 secret gist 并把 id 填入 preferences。
- 口令持久化:不存口令。

## 4. 架构

同步是叠加在现有单机存储之上的独立操作,不替换 `LocalSecretStore`。本机 store 仍是真相源。

```
Sync Secrets 命令 (src/sync.tsx)
   │  1. 读 preferences (token, gistId);缺失则报错引导
   │  2. 弹密码框输入口令
   │  3. gist 客户端拉取 → vault 解密 → 远端 Secret[]
   │  4. merge(本机 Secret[], 远端 Secret[]) → 合并 Secret[]
   │  5. 写回本机 store(覆盖为合并结果) + vault 加密 → gist 客户端上传
   ▼
[ vault 加密 ]   [ merge 纯函数 ]   [ gist 客户端 ]
src/crypto/      src/sync/          src/sync/
 vault.ts         merge.ts           gist-client.ts
```

各单元单一职责、可独立测试。命令层负责编排与 UI;数据层(vault/merge)为纯逻辑。

## 5. 加密信封格式

上传到 gist 的文件内容是如下 JSON(全部二进制字段 base64 编码):

```json
{
  "v": 1,
  "kdf": "scrypt",
  "n": 16384, "r": 8, "p": 1,
  "salt": "<base64>",
  "iv": "<base64>",
  "authTag": "<base64>",
  "ciphertext": "<base64>"
}
```

- 口令 + 随机 16 字节 salt 经 scrypt(N=16384,r=8,p=1)派生 32 字节密钥。
- AES-256-GCM,随机 12 字节 IV,加密明文(`JSON.stringify(Secret[])`)。
- GCM authTag 单独存,解密时校验;口令错或数据被篡改 → 校验失败 → 抛"口令错误或数据损坏"。
- 全部用 `node:crypto`(基础插件已确认运行时仅暴露 node 模块,非全局 crypto)。

## 6. 数据模型

复用基础插件的 `Secret`(`id/title/content/createdAt/updatedAt`),不新增字段(用户选 A,无墓碑)。

Gist 文件:单个文件(如 `secrets.json.enc`),内容为 §5 的信封 JSON。

## 7. 合并策略

`merge(local: Secret[], remote: Secret[]): Secret[]`(纯函数):

- 按 `id` 取并集。
- 同一 id 在两边都存在时,取 `updatedAt` 较大者;相等时取本机(确定性)。
- 结果按 `updatedAt` 倒序返回。

合并结果同时写回本机 store 与重新加密上传 gist,同步后两边内容一致。

## 8. 配置(manifest preferences)

新增到 `package.json`:

```json
"preferences": [
  {
    "name": "githubToken",
    "title": "GitHub Token",
    "description": "Personal access token with 'gist' scope.",
    "type": "password",
    "required": true
  },
  {
    "name": "gistId",
    "title": "Gist ID",
    "description": "ID of a private gist to sync into. Create an empty secret gist first.",
    "type": "textfield",
    "required": true
  }
]
```

## 9. 数据流细节

1. `getPreferenceValues` 读 token/gistId;任一为空 → Toast 引导用户去扩展设置填写,终止。
2. 弹口令输入(一个简单 Form,password 字段);为空 → 提示并终止。
3. `gistClient.read(token, gistId)` → 取目标文件内容。空 gist(首次)→ 视为远端无数据。
4. 远端有内容 → `vault.decrypt(信封, 口令)` → 远端 `Secret[]`;解密失败 → Toast"口令错误或数据损坏",终止(不写任何东西)。
5. `local = await store.list()`;`merged = merge(local, remote)`。
6. 写回本机:把 store 覆盖为 merged(新增 store 能力,见 §10)。
7. `vault.encrypt(merged, 口令)` → `gistClient.write(token, gistId, 信封)`。
8. 成功 Toast,带合并后条目数。

## 10. 对现有代码的改动

- `SecretStore` 接口与 `LocalSecretStore` 新增一个方法:`replaceAll(secrets: Secret[]): Promise<void>`,用于同步把本机整体覆盖为合并结果。原子写入(沿用现有 writeAll)。补单测。
- 其余命令(save/search/...)不变。

## 11. 错误处理

- preferences 缺失:明确 Toast + 指引去设置填写。
- 网络/GitHub API 失败(401/403/404/超时):Toast 显示状态与简述,不重试(手动命令,用户可再跑)。
- 解密失败:统一 Toast"口令错误或数据损坏",不区分以免泄露信息;不写本机、不写 gist。
- 任何错误信息均不含明文内容或口令(spec §2)。

## 12. 测试策略

- `src/crypto/vault.test.ts`:encrypt→decrypt 往返还原;错口令解密失败;信封被篡改(改 ciphertext/authTag)解密失败;信封字段齐全。
- `src/sync/merge.test.ts`:并集;同 id 冲突取较新;updatedAt 相等取本机;空本机/空远端;结果按 updatedAt 倒序。
- `LocalSecretStore.replaceAll`:覆盖后 list 返回新集合;空集合清空。
- gist 客户端与 sync 命令层薄,主要靠 `npm run dev` 手动验证(两台设备或同机模拟)。

## 13. 项目结构(预期新增/改动)

```
src/
  crypto/
    vault.ts            # encrypt/decrypt (AES-256-GCM + scrypt), 纯逻辑
    vault.test.ts
  sync/
    merge.ts            # merge(local, remote) 纯函数
    merge.test.ts
    gist-client.ts      # GitHub Gist read/write 薄封装
  sync.tsx              # Sync Secrets 命令
  storage/
    types.ts            # SecretStore 接口 +replaceAll
    local-store.ts      # 实现 replaceAll +单测
package.json            # 新增 sync 命令声明 + preferences
```
