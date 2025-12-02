# BLUEPRINT: {{taskId}}

## 1. IDENTITY

### This Task IS:
{{isScope}}

### This Task IS NOT:
{{isNotScope}}

### Anti-Hallucination Anchors:
{{antiHallucinationAnchors}}

### 🚫 Guardrails (Prohibitions):

**Scope Guardrails:**
{{scopeGuardrails}}

**Architecture Guardrails:**
{{architectureGuardrails}}

**Quality Guardrails:**
{{qualityGuardrails}}

**Security Guardrails:**
{{securityGuardrails}}

## 2. CONTEXT CHAIN

### Priority 0 - LEGACY REFERENCE (If Available):
{{legacySystemContext}}

### Priority 1 - READ FIRST (Required):
{{priority1Files}}

### Priority 2 - READ BEFORE CODING:
{{priority2Files}}

### Priority 3 - REFERENCE IF NEEDED:
{{priority3Files}}

### Inherited From Dependencies:
{{inheritedFromDependencies}}

## 3. EXECUTION CONTRACT

### 3.1 Pre-Conditions (VERIFY BEFORE ANY CODE):
| Check | Command | Expected |
|-------|---------|----------|
{{preConditionsTable}}

**HARD STOP:** If ANY check fails → status: blocked

### 3.2 Success Criteria (VERIFY AFTER COMPLETE):
| Criterion | Command |
|-----------|---------|
{{successCriteriaTable}}

### 3.3 Output Artifacts:
| Artifact | Type | Path | Verification |
|----------|------|------|--------------|
{{outputArtifactsTable}}

## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
{{phase1Steps}}

**Gate:** {{phase1Gate}}

### Phase 2: Core Implementation
{{phase2Steps}}

**Gate:** {{phase2Gate}}

### Phase 3: Testing
{{phase3Steps}}

**Gate:** {{phase3Gate}}

### Phase 4: Integration
{{phase4Steps}}

**Gate:** {{phase4Gate}}

### Phase 5: Validation
{{phase5Steps}}

## 5. UNCERTAINTY LOG

| ID | Topic | Assumption | Confidence | Evidence |
|----|-------|------------|------------|----------|
{{uncertaintiesTable}}

### Stop Rule:
LOW confidence on critical decision → BLOCKED

## 6. INTEGRATION IMPACT

### Files Modified:
| File | Modification | Who Imports | Impact |
|------|--------------|-------------|--------|
{{filesModifiedTable}}

### Files Created:
| File | Imports From | Exports |
|------|--------------|---------|
{{filesCreatedTable}}

### Breaking Changes:
{{breakingChanges}}
