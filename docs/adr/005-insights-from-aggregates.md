# ADR-005: Insights from on-device aggregates; the model only writes the sentence

Status: Accepted · 2026-11-21

## Context
A monthly summary in plain language is useful, but sending every transaction to a model is a privacy and cost problem, and models are bad at arithmetic.

## Decision
The app computes the numbers (totals per category, this month vs last, top shops) with `src/lib/stats.ts`. Only those numbers go to `POST /insight`, which returns one or two sentences. If the user is offline or over the limit, a template sentence is built from the same numbers.

## Consequences
- The numbers are always correct and the AI part is optional.
- The wording is less "smart" than a model reading everything, which is the trade-off we want.
