# 🔄 DEEP RE-ANALYSIS: Breaking the Failure Loop

You are reviewing the task defined in {{promptPath}} and {{taskPath}}.
Our current plan lives in {{todoOldPath}}, which has FAILED code review multiple times.
{{failureHistory}}{{contextSection}}
Your job is to:
1. **Understand WHY previous attempts failed** (not just WHAT failed)
2. **Inspect reality** - verify actual code state vs. requirements
3. **Identify root cause** - is it incomplete implementation, wrong approach, or architectural mismatch?
4. **Produce a DIFFERENT strategy** that addresses root causes

# Operating Principles
- **Truth over optimism**: do not assume completion. Verify.
- **Minimal path to green**: prefer the smallest change set that achieves approval.
- **Deterministic output**: return exactly one updated TODO.md

# Required Output:

Based on the old {{todoOldPath}} and your analysis,
WRITE THE NEW {{todoPath}} from scratch

```
{{todoTemplate}}
```
