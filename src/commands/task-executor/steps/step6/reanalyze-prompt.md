# 🔄 DEEP RE-ANALYSIS: Breaking the Failure Loop

## OUTPUT RULES (Token Optimization)
- Respond in the shortest format possible without losing technical precision
- Use only the reasoning strictly necessary to execute the task
- Do not include explanations that don't contribute to the solution
- When running terminal commands, prefer silent versions (--silent, --quiet, -q) except when verbose output is needed for diagnosis

You are reviewing the task defined in {{promptPath}} and {{taskPath}}.
Our current plan lives in {{todoOldPath}}, which has FAILED code review multiple times.
{{failureHistory}}

---

## 📚 CONSOLIDATED CONTEXT (Token-Optimized)

The section below contains a **pre-built summary** of the project environment. Use this as your PRIMARY source of context.

**IMPORTANT: Token Optimization Strategy**
- ✅ **USE the summary below FIRST** - it has key information already extracted
- ✅ **Reference files are listed** - read them ONLY if you need more specific details
- ❌ **DO NOT re-read AI_PROMPT.md entirely** - the summary already has the key information

{{contextSection}}
---

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
