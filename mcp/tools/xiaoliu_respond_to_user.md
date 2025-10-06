# xiaoliu_respond_to_user（规范）

用途：在对用户输出前，拦截“询问式/等待确认”的内容，并校验是否已完成必要测试。

输入：
- response: string
- response_type: "info"|"action"|"completion"

检查项：
1) SIL-003 / IR-001 禁询问式（critical）
   - 禁止：是否继续/要不要/这样可以吗/需不需要/可否/要不要我…
   - 建议：直接给出方案/已执行结果/下一步
2) IR-009 必要测试校验（high）
   - 若涉及“开发/修改/修复已完成”的回复，需先有 run_tests 结果
   - 未发现测试证据时，建议：先运行测试并在[#TEST]登记

输出：
- 通过：{ success: true }
- 未过：{ success: false, violations: [{rule_id, severity, description, suggestion}], action_required: "按建议修改回复或先测试" }

自动确认（无询问模式）：
- 若检测到环境变量 `XIAOLIU_AUTO_CONFIRM=1` 或 `AUTO_CONFIRM=1`，工具应在可能的前提下自动删除询问式措辞并直接给出执行项；若仍存在阻断项（critical），直接返回未过并给出改写建议。
