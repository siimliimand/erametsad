# WCAG AA Colour Contrast Audit

**Date:** 2026-08-27
**Scope:** Design token pairs from `tokens.css`
**Standard:** WCAG 2.1 AA — 4.5:1 for normal text, 3:1 for large text (>=18px or >=14px bold)

## Results

| # | Pair | Ratio | AA Normal | AA Large |
|---|------|-------|-----------|----------|
| 1 | ink on bg-page (#1B211D / #FFFFFF) | 16.38:1 | PASS | PASS |
| 2 | ink-muted on bg-page (#6B7570 / #FFFFFF) | 4.77:1 | PASS | PASS |
| 3 | ink-inverse on primary-dark (#FFFFFF / #16382A) | 12.86:1 | PASS | PASS |
| 4 | ink-inverse on primary (#FFFFFF / #2E6B4F) | 6.30:1 | PASS | PASS |
| 5 | primary on bg-page (#2E6B4F / #FFFFFF) | 6.30:1 | PASS | PASS |
| 6 | ink on bg-mist (#1B211D / #F1F5F2) | 14.89:1 | PASS | PASS |
| 7 | ink-muted on bg-mist (#6B7570 / #F1F5F2) | 4.33:1 | **FAIL** | PASS |
| 8 | primary on primary-light (#2E6B4F / #E9F0EC) | 5.44:1 | PASS | PASS |
| 9 | ink-inverse on cta (#FFFFFF / #F2A93B) | 2.00:1 | **FAIL** | **FAIL** |
| 10 | ink on cta (#1B211D / #F2A93B) | 8.20:1 | PASS | PASS |
| 11 | danger on danger-light (#B3261E / #FBEAE9) | 5.62:1 | PASS | PASS |
| 12 | info on info-light (#2D6FA8 / #E9F1F7) | 4.65:1 | PASS | PASS |
| 13 | status-ended on bg-page (#6B7570 / #FFFFFF) | 4.77:1 | PASS | PASS |
| 14 | status-draft on bg-page (#9E9E9E / #FFFFFF) | 2.68:1 | **FAIL** | **FAIL** |

## Failures

### 1. ink-inverse on cta — 2.00:1 (FAIL normal + large)

White text on `--color-cta` (#F2A93B). This is the primary call-to-action background. The orange is too light for white text at any size.

**Fix options:**
- Use `--color-ink` (#1B211D) instead of `--color-ink-inverse` on CTA backgrounds (ratio improves to 8.20:1).
- Darken `--color-cta` to at least #A66B13 (~4.5:1 with white) if white text is required.
- Use a darker CTA variant for text-heavy CTA elements.

### 2. ink-muted on bg-mist — 4.33:1 (FAIL normal, PASS large)

`--color-ink-muted` on `--color-bg-mist` passes for large text only (>=18px or >=14px bold). If used for body-sized text (under 18px), it fails.

**Fix options:**
- Darken `--color-ink-muted` to #5A635F or darker (~4.5:1).
- Limit `--color-ink-muted` on mist backgrounds to large text only (>=18px).

### 3. status-draft on bg-page — 2.68:1 (FAIL normal + large)

`--color-status-draft` (#9E9E9E) on white fails at all sizes.

**Fix options:**
- Darken `--color-status-draft` to at least #767676 (~4.5:1) or #8C8C8C (~3.0:1 for large).
- Use `--color-ink-muted` (#6B7570) for draft status text on white backgrounds (4.77:1).

## Summary

- **11 pairs pass AA at all text sizes.**
- **1 pair passes large text only** (ink-muted on bg-mist).
- **2 pairs fail at all sizes** (ink-inverse on cta, status-draft on bg-page).
