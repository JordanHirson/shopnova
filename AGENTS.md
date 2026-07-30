# AGENTS.md

## ShopNova MVP

This repository contains the ShopNova MVP, a university capstone project.

The objective is to build a polished, production-quality MVP within approximately 40 development hours.

Always optimize for simplicity, maintainability, and code quality over feature completeness.

---

## Core Rules

- Only implement the task requested in the current prompt.
- Do not add extra features.
- Stop immediately after completing the requested milestone.
- Do not refactor working code unless required for the current task.
- Reuse existing components whenever possible.
- Keep the existing project architecture consistent.

---

## Code Quality

- Use strict TypeScript.
- Write clean, readable, modular code.
- Prefer reusable components.
- Avoid duplication.
- Keep files reasonably small.
- Remove unused code.

---

## UI

- Use shadcn/ui components where appropriate.
- Use Tailwind CSS.
- Keep the UI modern, clean and responsive.
- Prioritize functionality over visual polish.

---

## Database

- Use Prisma ORM.
- Use PostgreSQL.
- Preserve existing relationships unless explicitly instructed otherwise.
- Do not modify the schema unless the current task requires it.

---

## Dependencies

Do not introduce new packages unless they provide clear value for the requested task.

If a new dependency is required, explain why before using it.

---

## Security

- Never expose secrets.
- Never commit environment variables.
- Validate user input.
- Follow secure defaults.

---

## Before Finishing

Before completing a task:

- Ensure TypeScript remains error free.
- Keep the codebase consistent.
- Summarize what changed.
- Do not continue beyond the requested milestone.