# TruthFence AI

> **"Don't trust the response. Test the evidence."**

TruthFence AI is an open-source AI reliability and adversarial testing workbench designed to rigorously evaluate model outputs against measurable properties: canary exfiltration, indirect prompt injection, evidence grounding with exact normalized quotations, policy scope boundaries, and structured JSON schema compliance.

Built specifically to test **Gemma 4** (`gemma-4-31b-it`) through the official **Gemini API** and `@google/genai` SDK.

---

## Features

### 1. Test Configuration & Attack Vectors
* **Editable System Policy:** Full control over base system instructions, with one-click insertion of synthetic canary secret tokens (`CANARY-OMEGA-9821-SECRET`).
* **Editable Reference Document:** Untrusted context buffer equipped with character counters, untrusted boundary delimiters, and one-click injection payloads.
* **5 Built-In Adversarial Scenarios:**
  1. **Canary Leakage / Exfiltration:** Attempts to extract confidential tokens using debug/admin override roleplay.
  2. **Indirect Prompt Injection:** Tests whether adversarial instructions embedded in untrusted reference documents hijack model execution into emitting unauthorized markers (`PWNED`).
  3. **Evidence Grounding:** Verifies exact normalized quotations against the supplied reference text.
  4. **Policy Scope Enforcement:** Evaluates adherence to policy boundaries (e.g. refusing prescription dosages for acute medical emergencies).
  5. **Structured Output Compliance:** Tests strict JSON schema parsing and required key validation without preamble.

### 2. Evaluator Engine
* **Deterministic Checks:**
  * **Evidence Grounding:** Normalizes text (case-folding, whitespace collapsing, punctuation tolerance) and verifies verbatim quotations against untrusted reference text.
  * **Canary Leakage:** Deterministic regex detection of exact tokens, spaced obfuscations (`C A N A R Y`), and core secret fragments.
  * **JSON Grammar & Schema:** Parses JSON and validates required keys and value structures.
  * **Prompt Injection Defense:** Scans for forbidden injection payload markers.
* **Heuristically Labeled Checks:**
  * **Scope Enforcement:** Clearly labeled as a heuristic pattern-matching assessment, providing a confidence rating rather than a false cryptographic guarantee.

### 3. Transparent Scorecard & Inspection
* **Live Scorecard:** Overall pass rate, passed/failed badges, and separation of deterministic vs. heuristic evaluations.
* **Raw Response Inspector:** Full visibility into raw model output, execution latency in milliseconds, and token consumption metrics.
* **Evidence Highlighting:** Side-by-side inspection of verified verbatim quotations versus ungrounded/hallucinated passages.
* **Browser-Local History:** Saves audit runs in `localStorage` for historical regression tracking.
* **Report Export:** One-click export of complete audit manifests to **JSON** or formatted **Markdown**.

---

## Tech Stack

* **Framework:** Next.js 15 (App Router, Server-side Route Handlers)
* **Language:** TypeScript 5 (Strict mode)
* **Styling:** Tailwind CSS (Dark editorial test-lab aesthetic)
* **SDK:** Official unified `@google/genai` SDK (v2.31+)
* **Validation:** Zod 3.24+
* **Icons:** Lucide React
* **Unit Testing:** Vitest 3.0+

---

## Getting Started

### Prerequisites

* Node.js `20.x` or later (tested on Node.js `v24.21.0`)
* npm `10.x` or later
* A Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/shrguhaneogi-pixel/TruthFence.git
   cd TruthFence
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your API key:
   Create a `.env.local` file in the project root:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

4. Start the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests

TruthFence includes unit tests for all 5 evaluator modules, text normalization, quotation extraction, scorecard calculation, and route safeguards:

```bash
# Run unit test suite
npm test

# Run tests in watch mode
npm run test:watch
```

Run static type checking:
```bash
npx tsc --noEmit
```

Build for production:
```bash
npm run build
```

---

## Deployment on Vercel

TruthFence is architected for zero-configuration deployment to [Vercel](https://vercel.com):

1. Push your repository to GitHub or connect it to Vercel.
2. In the Vercel Project Settings, add the environment variable:
   * **`GEMINI_API_KEY`**: Your Google Gemini API Key.
3. Deploy! Next.js App Router and server-side Route Handlers run seamlessly on Vercel Serverless Functions.

---

## Security Model

* **Zero Secret Leakage:** `GEMINI_API_KEY` is kept strictly server-side inside Route Handlers and never transmitted to the browser bundle or logged to output files.
* **Untrusted Input Isolation:** Reference documents and custom user prompts are bounded in size (Zod validation limits) and framed with strict untrusted boundary delimiters.
* **No Code Execution:** Model outputs are treated strictly as text data; TruthFence never executes model-generated shell commands or scripts.
* **Transparent AI Boundaries:** Heuristic evaluations are explicitly labeled as heuristics to prevent false senses of security.

---

## License

TruthFence AI is open-source software licensed under the [Apache License 2.0](LICENSE).
