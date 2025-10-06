# xiaoliu_write_code（规范）

用途：在写任何代码前，进行强制检查与建议修复，避免重复开发、硬编码与说明缺失。

输入（参见 ../接口/工具契约.schemas.json）：
- code: string（≥10）
- file_path: string
- purpose: string（≥5）
- explanation: string（≥50，需包含：为什么这样实现/考虑过什么方案/为何选择该方案）

检查项（S1 必开）：
1) IR-003 禁硬编码（critical）
   - 匹配模式列表：见 ./_patterns.hardcode.txt
   - 典型命中：绝对路径（C:\、/root/）、密钥字段（password/token/secret/api_key）、服务地址硬写
   - 修复建议：移至配置（config/params.json 或 .env），通过参数传入
2) IR-010 开发前查重（critical）
   - 必须先调用 xiaoliu_search_codebase(query=purpose)
   - 若 similarity ≥ 0.7 的匹配存在 → 违规：建议复用/扩展现有模块，并列出匹配文件
3) IR-005 先解释再修改（high）
   - explanation 长度 ≥ 50，且包含：理由/备选/取舍

输出：
- 通过：
  - { success: true, checks_passed: ["IR-003","IR-010","IR-005"], allowed_to_proceed: true }
- 未过：
  - { success: false, error: "代码未通过规则检查", violations: [
      { rule_id: "IR-003", severity: "critical", description: "发现2处硬编码", locations: [{line: 12, value: "C:\\data"}], suggestion: "改为从config读取路径" },
      { rule_id: "IR-010", severity: "critical", description: "发现相似模块", existing_modules: [{file: "src/utils/export.ts", similarity: "85%", description: "数据导出"}], suggestion: "复用或明确说明为何新建" },
      { rule_id: "IR-005", severity: "high", description: "解释过短(<50)" }
    ], action_required: "按建议修复后重试" }

示例（允许通过的说明要点）：
- 说明包含：
  - 采用A方案的原因（兼容性/性能/一致性）
  - 比较过B/C方案，为何不选
  - 对调用方的影响与回滚策略

备注：
- 违反 critical 不可继续写入；high 建议修复，S2起可策略化为阻断
- 建议在提交[#TEST]时附测试报告路径（tests/report.html或CI链接）
