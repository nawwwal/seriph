# Active Plan: Seriph Durable Batch Import Pipeline

The canonical implementation plan is:

- [Detailed implementation plan](../docs/superpowers/plans/2026-07-18-seriph-durable-import-pipeline.md)
- [Approved architecture specification](../docs/superpowers/specs/2026-07-17-seriph-durable-import-pipeline-design.md)
- [Execution checklist](./todo.md)

This stable entrypoint exists for `/plan` and downstream build workflows. The canonical plan is not duplicated here so architecture, interfaces, commands, and task status cannot drift between two copies.

Implementation must proceed in task order and stop at each named checkpoint. Use `superpowers:subagent-driven-development` for fresh task contexts and two-stage review, or `superpowers:executing-plans` for inline checkpointed execution.
