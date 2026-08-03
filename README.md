# Fund Region Allocation

[![Generate fund allocation release](https://github.com/baizhi958216/fund-region-allocation/actions/workflows/generate-release.yml/badge.svg)](https://github.com/baizhi958216/fund-region-allocation/actions/workflows/generate-release.yml)

从中国公募基金定期报告中提取 QDII 基金的国家/地区配置，自动校验数据，并生成按美国股票占基金净值比例排序的对比图。

这是一个以自然语言为入口的 Codex Skill。用户只需要告诉 Codex 基金、报告期和期望输出，Codex 会自动调用仓库中的 Node.js 模块完成抓取、解析、校验和制图。命令行仅用于开发与调试。

## 功能

- 根据基金代码查找指定季度报告
- 下载并解析公开披露的 PDF 报告
- 提取“按国家（地区）分类”的股票及存托凭证配置
- 统一美国、中国、中国香港、韩国、日本和其他地区口径
- 检查地区明细、报告合计和最终图表是否一致
- 生成 PNG、SVG、CSV 和完整来源证据 JSON
- 自动按美国配置比例从高到低排序

## 安装为 Codex Skill

```bash
git clone https://github.com/baizhi958216/fund-region-allocation.git \
  ~/.codex/skills/fund-region-allocation
```

重新打开 Codex 任务后直接使用自然语言调用，无需手动运行脚本：

```text
使用 $fund-region-allocation 抓取这些基金的 2026Q2 地域配置，
按美国占比排序，生成 PNG、SVG、CSV 和来源证据。
```

也可以让 Skill 自动选择 16 只基金共同可用的最新季度：

```text
使用 $fund-region-allocation 生成最新一期基金地域配置总结图。
```

首次执行时，Codex 会在 Skill 目录内自动运行 `npm ci` 安装锁定依赖，后续无需重复安装。

Skill 的触发说明和完整工作流位于 [`SKILL.md`](SKILL.md)。

## 开发与调试

以下命令不是普通 Skill 用户的必需步骤，仅供本地开发和排查问题使用：

```bash
git clone https://github.com/baizhi958216/fund-region-allocation.git
cd fund-region-allocation
npm ci

node scripts/run-pipeline.mjs \
  --period 2026Q2 \
  --output-dir ./outputs \
  --reference-label
```

参数说明：

| 参数 | 说明 |
| --- | --- |
| `--period` | 报告期，格式为 `YYYYQ1` 至 `YYYYQ4`；使用 `latest` 自动选择所有基金共同可用的最新季度 |
| `--output-dir` | 图片、表格和证据文件的输出目录 |
| `--work-dir` | 可选，PDF 和中间数据目录；默认位于输出目录的 `.work` |
| `--reference-label` | 可选，将图中的灰色剩余项显示为“现金”，以匹配参考图样式 |

## 输出文件

以 `2026Q2` 为例：

```text
outputs/
├── fund-region-allocation-2026Q2.png
├── fund-region-allocation-2026Q2.svg
├── fund-region-allocation-2026Q2.csv
└── fund-region-allocation-2026Q2-evidence.json
```

- PNG：适合公众号、社交媒体和普通预览
- SVG：可在 Figma、Illustrator 等工具中继续编辑
- CSV：包含排名、基金代码和各地域的原始百分比
- Evidence JSON：包含报告标题、发布日期、PDF 地址、来源页码、原始地区行和分类注释

## 修改基金清单

默认基金列表位于 [`assets/funds.json`](assets/funds.json)。每只基金保留一个代表份额，避免 A/C 类或人民币/美元份额重复：

```json
{
  "code": "016701",
  "short_name": "银华海外数字",
  "full_name": "银华海外数字经济量化选股混合型发起式证券投资基金（QDII）"
}
```

修改或增加基金后，让 Codex 重新生成即可；Codex 会自动执行完整流水线。

## Tag 自动生成与发布

仓库内置 GitHub Actions。每次向 GitHub 推送任意 Tag，工作流都会：

1. 使用 `package-lock.json` 安装锁定的 Node.js 依赖并运行测试。
2. 为默认的 16 只基金下载和解析季度报告。
3. 生成 PNG、SVG、CSV 和证据 JSON。
4. 上传一份保留 30 天的 Actions Artifact。
5. 创建对应的 GitHub Release，并将四类文件作为 Release Assets 发布。

推荐使用带报告期的 GPG 签名 Tag：

```bash
git tag -s 2026Q2 -m "Generate 2026Q2 fund allocation"
git push origin 2026Q2
```

Tag 名包含 `YYYYQn` 时，工作流生成该季度，例如 `2026Q2` 或 `v2026Q2`。Tag 名不包含报告期时，例如 `v1.0.0`，工作流会选择 16 只基金共同可用的最新季度，避免不同基金混用报告期。

工作流定义见 [`.github/workflows/generate-release.yml`](.github/workflows/generate-release.yml)。创建 Release 所需的权限只在工作流内设置，不需要额外的个人访问令牌。

## 数据口径

程序提取定期报告中的：

```text
报告期末在各个国家（地区）证券市场的股票及存托凭证投资分布
```

默认分类规则：

- `中国`、`中国大陆`、`中国内地`归入“中国”
- `中国香港`、`香港`归入“中国香港”
- `中国台湾`按当前参考图口径归入“其他”
- 未单列的国家和地区统一归入“其他”
- `现金及其他 = 100% - 报告中的股票地域配置合计`

灰色剩余项可能包含现金、基金、债券、衍生品、应收项目及负债影响，不一定是严格意义上的现金。详细规则见 [`references/allocation-rules.md`](references/allocation-rules.md)。

## 数据校验

生成图表前会检查：

1. 解析出的国家/地区明细是否与报告合计一致。
2. 所有图表分段是否在容差范围内合计为 100%。
3. 是否保留了报告网址和来源页码。
4. 是否出现负数剩余项或缺失报告。

任何一项失败都会停止生成图表，不会用零值静默补齐。

## 项目结构

```text
fund-region-allocation/
├── .github/workflows/generate-release.yml
├── SKILL.md
├── README.md
├── package.json
├── package-lock.json
├── agents/openai.yaml
├── assets/
│   ├── funds.json
│   └── chart-style.json
├── references/
│   ├── allocation-rules.md
│   └── source-priority.md
├── scripts/
    ├── lib/
    ├── fetch-reports.mjs
    ├── extract-allocations.mjs
    ├── validate-data.mjs
    ├── render-chart.mjs
    └── run-pipeline.mjs
└── test/
    ├── period.test.mjs
    └── table.test.mjs
```

## 注意事项

- 不使用前十大持仓推算完整地域配置。
- 第三方公告接口只作为公开报告的检索和下载镜像，证据文件会保留原报告标题、发布日期和 PDF 地址。
- 本项目生成的内容用于公开数据整理与可视化，不构成投资建议。
