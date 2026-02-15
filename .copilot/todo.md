# Task List

## 1. Change "Inscribe" → "Engrave" on the button
- **File:** `src/components/UI/ControlPanel.jsx`
- **Change:** Button text from "Inscribe" to "Engrave"
- **Status:** [x] ✅ Done

## 2. Change "Botai Inscriptions" → "Personalize your Botai" (top-left section title)
- **File:** `src/components/UI/ControlPanel.jsx`
- **Change:** Section title → `Personalize your <b>Botai</b>`
- **Status:** [x] ✅ Done

## 3. Change default text placeholder to "Enter your engravings"
- **File:** `src/components/UI/ControlPanel.jsx`
- **Change:** placeholder `"Enter text"` → `"Enter your engravings"`
- **Status:** [x] ✅ Done

## 4. Confirm button (✓ next to text input) → stylish light blue on highlight/active
- **File:** `src/components/UI/ControlPanel.jsx` (DeferredTextInput)
- **Change:** `hasChanges` color → `#4A9FE5` with `box-shadow: 0 2px 8px rgba(74,159,229,0.4)`
- **Status:** [x] ✅ Done

## 5. Font dropdown: uniform cross-browser custom styling
- **File:** `src/components/UI/ControlPanel.jsx` & `src/App.css`
- **Solution:** Built a `CustomDropdown` component replacing native `<select>`, with fully controlled styling
- **Status:** [x] ✅ Done

## 6. UV warning text update + fix white-on-white color
- **File:** `src/components/UI/ControlPanel.jsx`
- **Change:** Text → "Fonts stand outside of the Botai, please try to reduce font size or change location."
- **Note:** Warning box uses orange bg (`#fff3e0`) with `#e65100` text (already visible). CSS is correct.
- **Status:** [x] ✅ Done

## 7. Keep each text's position when reset
- **File:** `src/App.jsx` (handleReset)
- **Change:** Preserved `clickData` during reset; only clear `geometry` (not position)
- **Status:** [x] ✅ Done

## 8. Make selected inscription card more obvious — blue border + shadow
- **File:** `src/App.css` (`.inscription-card--selected`)
- **Change:** `border: 2px solid #4A9FE5`, `background: #f5f9ff`, blue box-shadow glow
- **Status:** [x] ✅ Done
