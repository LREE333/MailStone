# MailStone — 11月15日交付物清单

**写给谁：** Bibi Leung（指导老师）
**日期：** 2026年11月15日
**课程：** LIN4049 毕业设计
**提交方式：** GitHub 链接 + 困难文档（`docs/CHALLENGES.md`）

---

## 一、提交方式

老师要求：提交 GitHub 仓库链接即可。

### 推送步骤（在本地终端执行）

```bash
# 1. 在 GitHub 网站上创建一个新仓库（不要勾选 README/gitignore/license）
#    仓库名建议：mailstone

# 2. 关联远程仓库（替换 YOUR-USERNAME）
cd ~/Desktop/capstone/mailstone
git remote add origin https://github.com/YOUR-USERNAME/mailstone.git
git push -u origin main
```

### 提交给老师的就是这个链接

```
https://github.com/YOUR-USERNAME/mailstone
```

老师打开链接后看到的顺序：
1. **README.md** — 项目概述、演示方法、文件结构、关键发现
2. **docs/CHALLENGES.md** — 困难与解决文档（老师要求的那份）
3. **docs/PLAN-2026-11-15.md** — 详细项目计划

---

## 二、GitHub 首页会展示什么

### A. 可运行的原型（直接打开浏览器演示）

用 VS Code Live Server 打开 `index.html`，通过 URL 参数直接进入五个演示状态：

| 演示 | URL | 展示什么 |
|---|---|---|
| 1. 标准延期 | `?qa=extension-pre` | 问答流程 → GAR 9.6.1 政策检查 → 草稿 → lint 检查 |
| 2. 过期延期 | `?qa=extension-post` | 路线关闭 → 派生规则（suggest 级别）→ SEN 支援服务面板 |
| 3. TPG 范围外 | `?qa=extension-tpg` | 五级范围模型 → withhold → 指向未收集的 TPG 法规 |
| 4. 考试缺席 | `?qa=exam-ug` | 无中央规则 → 文档化 gap → SEN 路由（含"已确认"和"未确定"行） |
| 5. 成绩复议 | `?qa=grade` | 9.2.1 → 9.2.2/9.2.3 → 14 工作日 → 事前联系标记 |

**老师能看到的完整链路：** 选课程类型 → 回答问题 → 看到<mark>政策条款原文引用</mark> → 生成草稿 → 点击"Check this draft" → 看到 lint 检查结果 → 看到 SEN 支援服务面板（含已确认/未确定信息） → 看到 Fact Lock 事实锁定面板 → 发送前检查表。

### B. 数据层（打开 JSON 文件查看）

| 文件 | 内容 | 数量 |
|---|---|---|
| `data/policy/sources.json` | 已验证的政策来源 | 10 个来源，6 个已检索 |
| `data/policy/rules.eduhk.json` | 结构化规则 + 支援服务 | 11 条规则 + 1 个支援服务 |
| `data/quality/violations.json` | 负面语料转化成的检查规则 | 12 条违规检查 |
| `data/exemplars/corpus.json` | 已标注的正例语料 | 18 条（13 公开 + 5 自编） |
| `data/exemplars/exemplars.json` | 标注方案 + 收集计划 | 8 个 move + 8 个礼貌特征 |

**老师能验证什么：** 每条规则都有 `source_id` 指向来源文件 → 来源文件有 `url` 和 `retrieved_date` → 来源文件有 `verification_status` → 没有一条规则来自未检索的文件。打开 `tools/test.mjs` 运行 `node tools/test.mjs` → 65 个断言全部通过。

### C. 报告初稿（提交文档）

报告不需要在 15 日完成，但应该有以下章节的初稿或大纲：

#### 报告结构建议

1. **项目概述** — MailStone 是什么，为谁做，解决什么问题
2. **设计决策** — 为什么用确定性规则检索而非 RAG；为什么模板先于模型；为什么 lint 是可执行的失败目录而非禁止性 prompt
3. **政策基础** — 11 条规则、10 个来源、五级课程范围模型、三个空状态（out_of_scope / no_rule / by_design）
4. **关键发现**
   - EdUHK 没有独立的"特殊情况"政策（导师确认）
   - 考试缺席没有中央条款（文档化 gap）
   - SAO Academic Accommodation **明确覆盖作业截止日期延期**（2026-11-09 从官方网页确认）
   - AI 工具流程 = 报销方案框架下的导师事前审批
   - LTTC 提供 LLM Studio/MaaS，通过工作坊和学分课程访问
5. **语料设计** — 18 条标注语料（13 公开 + 5 自编）；Swales move 分析 + Biesenbach-Lucas 礼貌特征；provenance 分离原则
6. **Lint 系统** — 12 条检查规则；三个层级（词汇/结构/政策交叉检查）；已知限制（V08 计句子不计动作）
7. **评估计划** — 模板 vs 模型 vs 人工 三方对比；双盲编码；kappa 一致性
8. **局限与未来工作** — TPG/RPG 法规未收集；SAO 回顾性问题未解决；模型集成待定（LTTC 或报销）

---

## 二、15 日之后的时间线

| 日期 | 里程碑 |
|---|---|
| 15 Nov | MVP：可运行原型 + 数据层 + 报告初稿大纲 |
| ~20 Nov | 与 Bibi 第三次会面：演示原型，讨论报告方向 |
| 30 Nov | 提交修改后的提案（10%）；决定 LTTC vs 报销 |
| 12 月 | 语料双编码；模型集成（如 LTTC 可用）；评估实验 |
| 1 月 | 完整报告提交 |

---

## 三、15 日前还需完成的任务（按优先级）

### 必须完成（影响演示）

1. **验证五个演示状态都能正常运行** — 打开浏览器逐个测试
2. **确保 SEN 支援服务面板的"Confirmed"和"Not established"行都能显示** — 这是 SAO 回复后的新功能
3. **准备一段 3-5 分钟的演示脚本** — 按五个状态顺序走一遍

### 应该完成（影响报告）

4. **写报告第 4 章（关键发现）初稿** — 这是最有内容可写的章节
5. **整理数据层统计** — 规则数、来源数、语料数、测试数（一句话总结）
6. **写一段方法学说明** — 为什么每条规则都有 verbatim quote，为什么 scope 是必需字段

### 可以后续完成

7. 语料双编码（需要第二位编码者）
8. 模型集成（需要 LTTC 访问或报销批准）
9. TPG/RPG 法规收集

---

## 四、给老师的一句话总结

> "MailStone 目前是一个可运行的原型：学生回答 6-8 个问题后，系统从 11 条已验证的 EdUHK 学术法规中选取适用条款，生成一份草稿邮件，并用 12 条从负面语料提炼的检查规则扫描草稿中的问题。政策基础覆盖本科、副学位和 PGDE 三个课程层级；TPG 和 RPG 被识别但刻意不引用。18 条标注语料已完成首轮编码。最关键的发现是：SAO 的 SEN 支援服务网页明确将'作业截止日期延期'列为可能的合理便利——这意味着过期提交时虽然正常路线已关闭，但一条支援服务路线确实存在。"
