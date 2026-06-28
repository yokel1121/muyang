# 沐阳志愿填报系统

面向高考志愿填报的静态网站，包含全国普通高校库、冲稳保推荐、兴趣专业匹配，以及 2022-2025 年各省专业录取分数线预测。

## 本地运行

```bash
python3 -m http.server 8034
```

打开 `http://127.0.0.1:8034/`。专业分数线数据通过 `data/major-scores/` 按生源省份加载，省级数据包为 gzip 压缩 JSON。

## 重新构建

```bash
python3 scripts/build-major-score-data.py
node scripts/build-single.js
```

原始 Excel 数据放在 `各专业分数线/`，该目录已加入 `.gitignore`；线上只需要提交生成后的 `data/major-scores/*.json.gz` 与 `manifest.json`。
