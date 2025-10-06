# MCP 工具规范（S1/S2通用）

目的：在写代码/修改/回复/测试前，AI调用工具进行强制检查，减少错误与遗忘。

## 工具清单
- xiaoliu_search_codebase（查重）
  - 输入：{ query: string, scope?: string }
  - 输出：{ found: number, matches: [{file, summary, similarity}] }
  - 规则：IR-010 开发前查重；发现重复→建议复用

- xiaoliu_write_code（写代码前检查）
  - 输入：{ code: string, file_path: string, purpose: string, explanation: string }
  - 必填：code, file_path, purpose, explanation(≥50字符)
  - 检查：
    - IR-003 禁硬编码（路径/密钥/绝对地址）
    - IR-005 先解释再修改（explanation长度与要点）
    - IR-010 查重（与search结果结合）
    - 质量占位（命名/注释/基本格式）
  - 输出：
    - 通过：{ success: true, checks_passed: [...] }
    - 未过：{ success: false, violations: [{rule_id, description, locations?, suggestion}], action_required: string }

- xiaoliu_modify_file（修改前检查，可选）
  - 用法同 write_code；用于补丁级别修改

- xiaoliu_respond_to_user（回复前检查）
  - 输入：{ response: string, response_type: "info"|"action"|"completion" }
  - 检查：
    - SIL-003/IR-001 禁“询问式”与“等待确认”，要求直接结论与执行项
    - IR-009 是否已完成必要测试（未完成则建议先 run_tests）
  - 输出：同上

- xiaoliu_run_tests（测试执行）
  - 输入：{ scope: "lint"|"unit"|"integration"|"all", coverage_threshold?: number }
  - 输出：{ success: boolean, coverage?: number, reports: [paths] }

## 使用顺序（单窗口）
1) search_codebase → 复用/避免重复
2) write_code/modify_file → 强制检查+修复建议
3) run_tests → 生成测试证据
4) respond_to_user → 确认“非询问式”输出

## 自动确认（无询问）模式
- 当存在环境变量 `XIAOLIU_AUTO_CONFIRM=1`（或 `AUTO_CONFIRM=1`）时：
  - write_code/modify_file：默认走“直接执行”分支，仍保留规则阻断；
  - respond_to_user：自动移除询问式用语，要求直接结论与动作；
  - run_tests：若声明“已完成”，需在输出中附上测试证据路径或自动触发本地脚本。

## 违规级别
- critical：阻断写入或回复
- high：强烈建议修复，否则降级为警告（S2起可策略化）

## 登记要求
- 每次调用后，在“开发跟进记录.md”追加[#TEST]或[#TASK]，附证据路径（reports）
