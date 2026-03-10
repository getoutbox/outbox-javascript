# Git conventions

Use semantic commit prefixes for commit messages and PR titles (e.g. `feat:`, `fix:`, `docs:`, `chore:`).

# SDK conventions

- Never expose resource names. Always use the IDs.
  - For example, a field with `author` with the resource name format of `parents/[parent_id]/resources/[id]` should be authorParentId and authorId.
- Use namespaces.
  - For example, instead of createMessage, do messages.create.
- Create your own SDK types based on the protobuf types.
