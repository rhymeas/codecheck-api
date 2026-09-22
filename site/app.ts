import {
  VALIDATORS,
  supportedTypes,
  completableTypes,
  validate,
  completeCheckDigit,
} from "../src/validators";

const types = supportedTypes();
const completable = new Set(completableTypes());

const typeSelect = document.getElementById("type") as HTMLSelectElement;
const valueInput = document.getElementById("value") as HTMLInputElement;
const out = document.getElementById("out") as HTMLPreElement;
const badge = document.getElementById("badge") as HTMLSpanElement;
const completeBtn = document.getElementById("complete") as HTMLButtonElement;
const table = document.getElementById("types") as HTMLTableSectionElement;

typeSelect.innerHTML = "";
for (const t of types) {
  const opt = document.createElement("option");
  opt.value = t;
  opt.textContent = `${t} — ${VALIDATORS[t].description}`;
  typeSelect.appendChild(opt);
}

function render(result: unknown, ok: boolean | null): void {
  out.textContent = JSON.stringify(result, null, 2);
  if (ok === null) {
    badge.textContent = "";
    badge.className = "badge";
    return;
  }
  badge.textContent = ok ? "VALID" : "INVALID";
  badge.className = ok ? "badge ok" : "badge bad";
}

function syncComplete(): void {
  const isCompletable = completable.has(typeSelect.value);
  completeBtn.disabled = !isCompletable;
  completeBtn.title = isCompletable
    ? "Compute the missing check digit"
    : "This type has no check digit to compute";
}

function setType(t: string, value: string): void {
  typeSelect.value = t;
  valueInput.value = value;
  syncComplete();
  runValidate();
}

function runValidate(): void {
  const result = validate(typeSelect.value, valueInput.value);
  render(result, result.valid);
}

document.getElementById("validate")!.addEventListener("click", runValidate);

completeBtn.addEventListener("click", () => {
  try {
    const result = completeCheckDigit(typeSelect.value, valueInput.value);
    render(result, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    render({ error: "invalid_body", message }, false);
  }
});

valueInput.addEventListener("keydown", (event) => {
  if ((event as KeyboardEvent).key === "Enter") runValidate();
});

for (const t of types) {
  const example = VALIDATORS[t].examples[0];
  const tr = document.createElement("tr");
  const cells = [t, VALIDATORS[t].description, example, completable.has(t) ? "yes" : "no"];
  cells.forEach((text) => {
    const td = document.createElement("td");
    td.textContent = String(text);
    tr.appendChild(td);
  });
  const action = document.createElement("td");
  const link = document.createElement("a");
  link.href = "#try";
  link.textContent = "try";
  link.addEventListener("click", () => setType(t, example));
  action.appendChild(link);
  tr.appendChild(action);
  table.appendChild(tr);
}

typeSelect.addEventListener("change", syncComplete);
setType(types[0], VALIDATORS[types[0]].examples[0]);
