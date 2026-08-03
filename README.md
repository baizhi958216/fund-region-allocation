# Fund Region Allocation

从中国公募基金定期报告中提取 QDII 基金的国家/地区配置，自动校验数据，并生成按美国股票占基金净值比例排序的对比图。

这个仓库既可以作为 Codex Skill 使用，也可以作为独立的 Python 命令行工具运行。

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

安装 Python 依赖：

```bash
python3 -m pip install pdfplumber Pillow
```

重新打开 Codex 任务后，可以这样调用：

```text
使用 $fund-region-allocation 抓取这些基金的 2026Q2 地域配置，
按美国占比排序，生成 PNG、SVG、CSV 和来源证据。
```

Skill 的触发说明和完整工作流位于 [`SKILL.md`](SKILL.md)。

## 命令行使用

```bash
git clone https://github.com/baizhi958216/fund-region-allocation.git
cd fund-region-allocation
python3 -m pip install pdfplumber Pillow

python3 scripts/run_pipeline.py \
  --period 2026Q2 \
  --output-dir ./outputs \
  --reference-label
```

参数说明：

| 参数 | 说明 |
| --- | --- |
| `--period` | 报告期，格式为 `YYYYQ1` 至 `YYYYQ4` |
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

修改或增加基金后，重新运行流水线即可。

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
├── SKILL.md
├── agents/openai.yaml
├── assets/
│   ├── funds.json
│   └── chart-style.json
├── references/
│   ├── allocation-rules.md
│   └── source-priority.md
└── scripts/
    ├── fetch_reports.py
    ├── extract_allocations.py
    ├── validate_data.py
    ├── render_chart.py
    └── run_pipeline.py
```

## 注意事项

- 不使用前十大持仓推算完整地域配置。
- 第三方公告接口只作为公开报告的检索和下载镜像，证据文件会保留原报告标题、发布日期和 PDF 地址。
- 本项目生成的内容用于公开数据整理与可视化，不构成投资建议。
