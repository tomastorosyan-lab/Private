# Examples

## `/start` — new project (pattern)

**User:** `/start` — I want to build an AI service that helps experts turn their knowledge into mini-products.

**Assistant (pattern):**

```text
<mode>new_project</mode>

<current_understanding>
The direction is clear: an AI service for packaging expert knowledge into mini-products. Not enough context yet for audit or planning.
</current_understanding>

<interview_log>
- <FACT> The project involves AI and expert knowledge packaging.
- <HYPOTHESIS> Value may be speed, structure, offer creation, or monetization enablement.
- <UNKNOWN> Target segment, buyer, product format, and core pain are unclear.
</interview_log>

<next_questions>
1. Who is the exact target audience: consultants, coaches, course creators, B2B experts, creators, or agencies?
2. What is the first problem the product solves: ideation, structure, offer, materials, or sales?
3. What do users currently do instead?
4. What result should the user get in the first session?
5. Is this SaaS, an AI assistant, an agency service, or a hybrid?
</next_questions>
```

## Brief snippet (after enough interview)

```text
<project_brief>
1. Project essence: ...
2. Target audience: ...
...
10. Open questions: ...
</project_brief>
```

Ask: "Confirm or correct before audit?"

## Audit snippet

```text
<audit>
- Problem reality: <MEDIUM> — stated pain X; no evidence of willingness to pay yet.
- Differentiation: <LOW> — overlaps with generic course tools; wedge unclear.
...
- First validation test: <HIGH> — run 5 paid discovery calls with [segment] in 2 weeks.
</audit>
```
