# Capability Naming

Capability names use a normalized format:

```text
<domain>.<action>_<object>
```

Examples:

- `billing.create_product`
- `billing.configure_webhook`
- `auth.create_project`
- `database.apply_schema`
- `deploy.release_app`
- `dns.attach_domain`
- `email.configure_sender`
- `verify.public_healthcheck`
- `secrets.store_value`

Rules:

- `domain` identifies the execution area, such as `billing` or `deploy`.
- `action_object` makes the side effect explicit.
- names should describe a provider-agnostic contract, not a vendor method name.
- names should stay stable even if the backing adapter or provider changes.

The package exports `CAPABILITY_NAME_PATTERN` so engines can enforce the convention consistently.
