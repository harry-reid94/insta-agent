# ManyChat Custom Field Updates

## How to Handle Response Fields

After your External Request in ManyChat, add these actions:

### 1. Set Multiple Custom Fields
Add Action → **Set Custom Field**

Map the response fields:
- Field: `stage` → Value: `{{external_request.actions.set_field.stage}}`
- Field: `last_response` → Value: `{{external_request.actions.set_field.last_response}}`
- Field: `updated_at` → Value: `{{external_request.actions.set_field.updated_at}}`

### 2. Apply Tags (Conditional)
Add Action → **Condition**
- If `{{external_request.actions.add_tag}}` has any value
- Then: Add Action → **Add Tag** → `{{external_request.actions.add_tag}}`

### 3. Update Qualification Fields
These are set automatically when the AI qualifies someone:
- `is_qualified` → Set by AI when portfolio >= $50k
- `Q1_bmb_understanding` → Set after user answers
- `Q2_portfolio_size` → Set after user answers
- `Q3_pain_points` → Set after user answers

## Complete Flow Example

```
Trigger: Keyword "Hello"
    ↓
External Request
    ↓
Set Custom Fields (batch update):
- stage = {{external_request.actions.set_field.stage}}
- last_response = {{external_request.actions.set_field.last_response}}
- updated_at = {{external_request.actions.set_field.updated_at}}
    ↓
Condition: If {{external_request.actions.set_field.is_qualified}} = "true"
    Then: 
    - Add Tags: qualified, bmb_prospect
    - Set Fields:
      - is_qualified = "true"
      - qualification_date = {{external_request.actions.set_field.qualification_date}}
      - booking_link = {{external_request.actions.set_field.booking_link}}
    ↓
Send Message: {{external_request.response}}
```

## Important Notes

1. **Initial State**: Set default values
   - `stage` = "greeting" (if empty)
   - `is_qualified` = "" (empty initially)

2. **Progressive Updates**: Fields fill as conversation progresses
   - Start: Only basic fields
   - During: Answers populate (Q1, Q2, Q3)
   - End: Qualification fields set

3. **Don't Override**: Only update fields that have values in the response

4. **Stage-Based Logic**: Use conditions based on `{{stage}}` to route conversation

The webhook handles all the logic - ManyChat just needs to:
1. Send current state
2. Apply the updates from response
3. Send the message