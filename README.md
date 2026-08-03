# Fund Region Allocation

[![Generate fund allocation release](https://github.com/baizhi958216/fund-region-allocation/actions/workflows/generate-release.yml/badge.svg)](https://github.com/baizhi958216/fund-region-allocation/actions/workflows/generate-release.yml)

从中国公募基金定期报告中提取 QDII 基金的国家/地区配置，自动校验数据，并生成按美国股票占基金净值比例排序的对比图。

这是一个以自然语言为入口的 Skill。只需要告诉 AI 基金、报告期和期望输出，将会自动调用仓库中的模块完成抓取、解析、校验和制图。

## 功能

- 根据基金代码查找指定季度报告
- 下载并解析公开披露的 PDF 报告
- 生成 PNG、SVG、CSV 和完整来源证据 JSON

## 使用 Skill

```text
使用 $fund-region-allocation 抓取这些基金的 2026Q2 地域配置，生成 PNG、SVG、CSV 和来源证据。
```

也可以让 Skill 自动选择 16 只基金共同可用的最新季度：

```text
使用 $fund-region-allocation 生成最新一期基金地域配置总结图。
```

首次执行时会在 Skill 目录内自动运行 `npm ci` 安装锁定依赖，后续无需重复安装。

Skill 的触发说明和完整工作流位于 [`SKILL.md`](SKILL.md)。

## 输出文件

以 `2026Q2` 为例：

```text
outputs/
├── fund-region-allocation-2026Q2.png
├── fund-region-allocation-2026Q2.svg
├── fund-region-allocation-2026Q2.csv
└── fund-region-allocation-2026Q2-evidence.json
```

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

## 数据校验

生成图表前会检查：

1. 解析出的国家/地区明细是否与报告合计一致。
2. 所有图表分段是否在容差范围内合计为 100%。
3. 是否保留了报告网址和来源页码。
4. 是否出现负数剩余项或缺失报告。

任何一项失败都会停止生成图表，不会用零值静默补齐。

## 注意事项

- 不使用前十大持仓推算完整地域配置。
- 第三方公告接口只作为公开报告的检索和下载镜像，证据文件会保留原报告标题、发布日期和 PDF 地址。
- 本项目生成的内容用于公开数据整理与可视化，不构成投资建议。
