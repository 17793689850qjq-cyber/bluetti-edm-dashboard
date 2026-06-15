# BLUETTI EDM Flow & Campaign Data

静态网页 + JSON 数据，覆盖 11 个 Klaviyo 站点：US、AU、CA、UK、FR、DE、IT、EU、ES、JP、CL。

**在线看板（GitHub Pages 默认）**：<https://17793689850qjq-cyber.github.io/edm-data-monitor/>

> **说明**：重命名仓库只会改变 URL 路径（如 `/edm-data-monitor/`），**不会**去掉 `17793689850qjq-cyber.github.io` 这段个人用户名前缀。要完全去掉 `github.io` 与个人 ID，只能绑定**自定义域名**，或将仓库迁到 **GitHub Organization** 后使用组织名前缀（见下文）。

## 架构

```
Klaviyo REST API  →  scripts/sync_dashboard.py  →  dashboard/data/dashboard-{7,30,60,90}d.json
                                                          ↓
                                              dashboard/index.html (GitHub Pages)
```

- **每日同步**：`.github/workflows/sync-dashboard.yml` 依次生成 7/30/60/90 天四套 JSON（`dashboard.json` 与 `dashboard-30d.json` 内容相同，默认 30 天）
- **页面部署**：`.github/workflows/deploy-pages.yml`（`dashboard/` 目录变更时自动发布）
- **页头区间选择**：预设切换加载对应 JSON；自定义范围需先通过 Actions 同步

## 本地预览（无需 API Key）

```bash
cd scripts
python build_seed_dashboard.py --all-presets

cd ../dashboard
python -m http.server 8080
# 打开 http://localhost:8080
```

## 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 添加各站 Private API Key：

| Secret 名称 | 站点 |
|-------------|------|
| `KLAVIYO_API_KEY_US` | 美国 |
| `KLAVIYO_API_KEY_AU` | 澳大利亚 |
| `KLAVIYO_API_KEY_CA` | 加拿大 |
| `KLAVIYO_API_KEY_UK` | 英国 |
| `KLAVIYO_API_KEY_FR` | 法国 |
| `KLAVIYO_API_KEY_DE` | 德国 |
| `KLAVIYO_API_KEY_IT` | 意大利 |
| `KLAVIYO_API_KEY_EU` | 泛欧账号 |
| `KLAVIYO_API_KEY_ES` | 西班牙 |
| `KLAVIYO_API_KEY_JP` | 日本 |
| `KLAVIYO_API_KEY_CL` | 智利 |

API Key 需具备 **Reporting** 读取权限。未配置的站点会在同步时跳过，并在 JSON 的 `meta.errors` 中记录。

## 启用 GitHub Pages

1. 仓库 **Settings → Pages**
2. **Build and deployment** → Source 选 **GitHub Actions**
3. 首次 push `dashboard/` 后，`Deploy Dashboard to GitHub Pages` workflow 会自动运行

## 如何绑定自定义域名（去掉 github.io 与个人 ID）

这是**唯一**能在代码侧配置、让用户访问 `https://edm.bluetti.com` 这类地址的方式。仓库内已包含占位文件 `dashboard/CNAME`（当前为 `edm-data.bluetti.com`），部署后 GitHub Pages 会读取该文件。

### 推荐子域名示例

| 示例 | 说明 |
|------|------|
| `edm.bluetti.com` | 简短，适合对外分享 |
| `klaviyo.bluetti.com` | 强调数据来源 |
| `data.bluetti.com` | 通用数据看板 |
| `edm-data.bluetti.com` | 与仓库名一致（CNAME 占位默认值） |

选定后，将 `dashboard/CNAME` 中的域名改为最终选用值，commit 并 push 到 `main`。

### GitHub 侧操作

1. 打开仓库 **Settings → Pages**
2. 在 **Custom domain** 填入与 `dashboard/CNAME` **完全一致**的域名（如 `edm.bluetti.com`）
3. 点击 **Save**，等待 DNS 检查通过（通常几分钟到 48 小时）
4. 勾选 **Enforce HTTPS**（证书签发成功后再开启）

### DNS 配置（由 BLUETTI IT / 域名管理员完成）

在 `bluetti.com` 的 DNS 服务商处为所选子域名添加记录：

**方式 A — CNAME（推荐，适用于项目站 `/edm-data-monitor/`）**

| 类型 | 主机记录 | 记录值 |
|------|----------|--------|
| CNAME | `edm`（或你选的子域前缀） | `17793689850qjq-cyber.github.io` |

**方式 B — 若将来迁到 GitHub Organization `bluetti`**

| 类型 | 主机记录 | 记录值 |
|------|----------|--------|
| CNAME | `edm` | `bluetti.github.io` |

**方式 C — A 记录（apex 根域或部分 DNS 不支持 CNAME 时）**

GitHub 当前 Pages IP 以官方文档为准，在 [GitHub Pages 文档](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) 查看最新 4 个 A 记录地址，添加到根域 `@`。

> 未在 DNS 中指向 GitHub 前，自定义域名无法访问；默认地址 `https://17793689850qjq-cyber.github.io/edm-data-monitor/` 仍可正常使用。

### 尚无自有子域时 — BLUETTI IT 待办清单

1. **决策**：与运营确认对外分享的子域名（见上表示例）
2. **DNS**：在 `bluetti.com` 添加 CNAME → `17793689850qjq-cyber.github.io`
3. **代码**：通知仓库维护者更新 `dashboard/CNAME` 并部署
4. **GitHub**：在仓库 Pages 设置中填写同一自定义域名并启用 HTTPS
5. **验收**：浏览器访问 `https://<所选子域>`，确认证书有效、看板数据正常加载

## 更简洁的 github.io 地址（仍含 github.io，无法完全去掉）

若暂时无法申请自定义域名，可将仓库迁到 **GitHub Organization**，用组织名替代个人 ID：

| 方案 | 操作概要 | 访问地址 |
|------|----------|----------|
| 组织 + 项目站 | 创建组织 `bluetti` 或 `BLUETTI-Official`，将本仓库转入该组织 | `https://bluetti.github.io/edm-data-monitor/` |
| 组织用户站 | 在组织下新建仓库 `bluetti.github.io`，将 `dashboard/` 内容作为根目录发布 | `https://bluetti.github.io/`（无路径后缀） |

组织方案仍需 GitHub 管理员创建组织、调整仓库归属与 Pages 权限；**不能**通过改仓库名 alone 实现。

> **无法仅靠代码实现**：在个人账号下，不绑自定义域名、不迁组织时，URL 前缀始终是 `https://<你的GitHub用户名>.github.io/...`。

## 手动同步

Actions 页选择 **Sync Klaviyo Dashboard** → **Run workflow**：

- 默认：同步 7/30/60/90 天四套数据
- 可选 `days`：仅同步单个预设
- 可选 `start_date` + `end_date`：自定义区间，输出 `dashboard-custom-YYYY-MM-DD_YYYY-MM-DD.json`

本地：

```bash
cd scripts
python sync_dashboard.py --days 30
python sync_dashboard.py --start 2025-05-01 --end 2025-05-31
```

## 数据口径

- 统计周期：页头可选近 7/30/60/90 天或自定义（需预同步 JSON）
- 转化 Metric：Placed Order
- GMV：各站本位币，汇总按固定汇率折算 CNY
- Campaign：已发送邮件
- Flow：Live / Draft，周期内有发送量

## 看板视图

1. **全球总览** — KPI、GMV 饼图/柱状图、各站对比表
2. **分站诊断** — 按站点折叠，Campaign / Flow 最佳与待优化（含 Subject 解读）
3. **Flow 待关注** — Draft、Sunset 等待处理项
4. **Playbook** — 成功/失败模式清单

## 自定义区间限制（静态站点）

GitHub Pages 无法按需调用 Klaviyo API。自定义日期需先在 Actions 或本地运行 `sync_dashboard.py --start … --end …` 生成对应 JSON 后，看板才能加载该区间数据。
