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

3) IR-031 执行前理解确认（critical）
   - 要求：在执行任何“会改变代码/文件/配置”的动作前，必须输出以下模板并等待“执行”指令：
     - 我对你的需求理解：<用大白话复述，一句话即可>
     - 解决方案（最短路径）：<步骤1-2-3>
     - 可能风险/回退：<一句话>
     - 需要你确认：<明确写“请回复：执行”>
   - 团队模式：由“小户”角色负责确认“执行”
   - 快捷确认：输入“~1”视为“执行”同等指令（记录到跟进日志）

输出：
- 通过：{ success: true }
- 未过：{ success: false, violations: [{rule_id, severity, description, suggestion}], action_required: "按建议修改回复或先测试" }

自动确认（无询问模式）：
- 若检测到环境变量 `XIAOLIU_AUTO_CONFIRM=1` 或 `AUTO_CONFIRM=1`，工具应在可能的前提下自动删除询问式措辞并直接给出执行项；若仍存在阻断项（critical），直接返回未过并给出改写建议。
