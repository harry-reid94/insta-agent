# ManyChat Response Field Mapping

## The webhook returns this structure:

```json
{
  "response": "The message to send to user",
  "next_stage": "rapport_building",
  "actions": {
    "set_field": {
      "stage": "rapport_building",
      "last_response": "The message",
      "updated_at": "2025-07-06..."
    },
    "add_tag": ["qualified"],
    "remove_tag": "unqualified"
  }
}
```

## How to use in ManyChat:

### 1. For the message to send:
```
{{external_request.response}}
```

### 2. For the next stage:
```
{{external_request.next_stage}}
```

### 3. For custom field updates:
```
{{external_request.actions.set_field.stage}}
{{external_request.actions.set_field.last_response}}
{{external_request.actions.set_field.updated_at}}
```

### 4. For tags to add:
```
{{external_request.actions.add_tag}}
```

## Complete Setup:

1. **Send Message Action**
   - Text: `{{external_request.response}}`

2. **Set Custom Field Action** (optional)
   - Field: stage → Value: `{{external_request.next_stage}}`
   
3. **Another Set Custom Field** (optional)
   - Field: last_response → Value: `{{external_request.response}}`

## Test Variables:
After External Request, add a test message to see all values:
```
Response: {{external_request.response}}
Stage: {{external_request.next_stage}}
Raw: {{external_request}}
```

This will show you exactly what fields are available.