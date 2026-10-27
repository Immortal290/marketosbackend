# Plan: Add Gemini via OpenRouter as image generation model

## Goal
Wire up image generation through OpenRouter using a Gemini model, expose the option in the target audience configuration, and ensure the selected model flows end-to-end to generate campaign images.

## Background / Current State
- `marketos-agents/agents/creative/image_engine.py` already defines `_generate_openrouter_image()` (line 552) but `image_agent_node()` never dispatches to it — no `openrouter`/`gemini` via OpenRouter branch exists in the if/elif chain (lines 94–157).
- `_generate_gemini_image()` (line 502) calls Google's Generative Language API directly, not OpenRouter.
- Frontend `TargetAudienceModal.tsx` already has image model + API key selection (lines 124–126, 664–753) but the dropdown has NO Gemini/OpenRouter image option.
- Frontend wizard (`campaign-wizard-store.ts`, `CampaignBrief` type, `Step0–4`) has no image model selection at all.
- Backend `CampaignBriefService` (`service.ts`) does not pass `image_model`/`image_api_key` into the agent payload sent to the Python agent service.
- DTO + validator for campaign_brief lack `imageModel`/`imageApiKey` fields.

## Decisions
1. **OpenRouter dispatch branch** — Add an `elif "openrouter" in image_model.lower()` branch in `image_agent_node` that calls `_generate_openrouter_image()`. Model name passed through as-is (e.g. `google/gemini-2.0-flash-exp:free`). Falls back to Pollinations on failure, matching existing pattern.
2. **Model identifier** — Use `google/gemini-2.0-flash-exp:free` as the Gemini-via-OpenRouter image model option in UI dropdowns. The exact string is passed to OpenRouter's `/images/generations` endpoint.
3. **Target audience placement** — The existing `TargetAudienceModal` is the "target audience" configuration UI. Add the Gemini via OpenRouter option to its image model dropdown. Also add image model selection to the campaign wizard (Step1Goal) so the wizard-launched pipeline also carries the setting.
4. **Data flow** — `image_model` + `image_api_key` flow: frontend wizard store → `CampaignBrief` type → `createAndLaunch` → backend DTO → validator → service → agent payload → Python agent state → `image_agent_node`.

## Tasks

### 1. Backend agent service — wire OpenRouter image dispatch
**File:** `marketos-agents/agents/creative/image_engine.py`
- In `image_agent_node()`, after the `gemini` direct-API branch (line 137) and before `black-forest`/`flux` (line 139), add:
  ```python
  elif "openrouter" in image_model.lower():
      api_key = image_api_key or os.getenv("OPENROUTER_API_KEY", "")
      if not api_key:
          agent_log("IMAGE", "No OpenRouter key — falling back to free Pollinations.ai")
          img_b64 = _generate_pollinations_image(full_prompt)
          source = "pollinations"
      else:
          agent_log("IMAGE", f"Generating with OpenRouter ({image_model})...")
          img_b64 = _generate_openrouter_image(full_prompt, api_key=api_key, model=image_model)
          source = "openrouter"
          if not img_b64:
              agent_log("IMAGE", "OpenRouter failed — falling back to Pollinations.ai")
              img_b64 = _generate_pollinations_image(full_prompt)
              source = "pollinations"
  ```
- No new dependencies needed — `_generate_openrouter_image` already exists.

### 2. Backend campaign_brief — DTO + validator + service
**File:** `marketos-backend/src/modules/campaign_brief/dto/campaign_brief.dto.ts`
- Add `imageModel?: string` and `imageApiKey?: string` fields.

**File:** `marketos-backend/src/modules/campaign_brief/validator.ts`
- Add `imageModel: z.string().optional()` and `imageApiKey: z.string().optional()` to the schema body.

**File:** `marketos-backend/src/modules/campaign_brief/service.ts`
- In `agentPayload`, add `image_model: data.imageModel` and `image_api_key: data.imageApiKey`.

### 3. Frontend types + store
**File:** `marketos-frontend/digital_marketing_agent-main/lib/brand-profile-api.ts`
- Add `imageModel?: string` and `imageApiKey?: string` to `CampaignBrief` interface.

**File:** `marketos-frontend/digital_marketing_agent-main/lib/campaign-wizard-store.ts`
- Add `imageModel: 'pollinations-flux'` and `imageApiKey: ''` to `defaultCampaignBrief`.

### 4. Frontend wizard UI — image model selection
**File:** `marketos-frontend/digital_marketing_agent-main/components/campaign-wizard/Step1Goal.tsx`
- Add an "Image Generation Model" select with options: `pollinations-flux` (default, free), `google/gemini-2.0-flash-exp:free` (Gemini via OpenRouter), `dall-e-3`, `dall-e-2`, `black-forest-labs/FLUX.1-schnell`, `custom`.
- Add an API key input for the image model (disabled when pollinations-flux selected).
- Wire `updateCampaignBrief({ imageModel, imageApiKey })`.

### 5. Frontend TargetAudienceModal — add Gemini via OpenRouter option
**File:** `marketos-frontend/digital_marketing_agent-main/components/ui/TargetAudienceModal.tsx`
- In the Image Generator Model `<select>`, add an optgroup "🔗 OpenRouter — Gemini" with `<option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash Exp (via OpenRouter)</option>`.
- Update `getModelProvider()` (line 240–247) to return `"openrouter"` for models containing `"google/"`.
- Update image key auto-fill logic (line 180–184) to map `google/` → `savedApiKeys.openrouter`.
- Update verification provider detection (line 327–331) to map `google/` → `"openrouter"`.

## Validation Plan
- Run lint/typecheck for backend (`npm run lint`/`npx tsc --noEmit` in `marketos-backend`) and frontend (`npm run lint`/`npx tsc --noEmit` in `marketos-frontend/digital_marketing_agent-main`).
- Confirm `_generate_openrouter_image` is reachable via the new dispatch branch (no syntax errors).
- Confirm the `image_model`/`image_api_key` fields appear in the agent payload from `CampaignBriefService.createAndLaunch`.
- Confirm the frontend wizard and TargetAudienceModal render the new Gemini via OpenRouter option.

## Out of Scope
- Changing the default image model (pollinations-flux remains default unless user selects Gemini).
- Modifying the OpenRouter image generation function itself (already implemented).
- Backend settings module changes (API keys already handled via UI modal).
