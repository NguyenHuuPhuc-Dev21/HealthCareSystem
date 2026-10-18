# ADR 0001: Record Architecture Decisions

## Status
Accepted

## Context
We need a standard mechanism to document significant architectural decisions, trade-offs, and design rationales for the Hospital Home-Care SaaS Platform.

## Decision
We will use Architecture Decision Records (ADRs) formatted in markdown within `docs/adr/`. Each record follows the standard format:
- Title with sequence number (`ADR-NNNN-<title>.md`)
- Status (Proposed, Accepted, Deprecated, Superseded)
- Context
- Decision
- Consequences (Positive and Negative)

## Consequences
- Architectural history and rationale are tracked in version control alongside code and baseline specifications.
- New engineers can trace why specific design constraints (such as the SQL-first database layer or email-only authentication) were chosen.
