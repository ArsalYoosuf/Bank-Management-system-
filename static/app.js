"use strict";

/* ============================================================
   Arsal Bank — dashboard client
   Change CURRENCY below if you want a different symbol.
   ============================================================ */

const CURRENCY = "$";
const MAX_AMOUNT = 10000000;
const MAX_NAME = 60;

const moneyFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat("en-US");
const money = (value) => `${CURRENCY}${moneyFormatter.format(Number(value) || 0)}`;

const el = {
  grid: document.getElementById("customer-grid"),
  empty: document.getElementById("empty"),
  emptyTitle: document.getElementById("empty-title"),
  emptyText: document.getElementById("empty-text"),
  emptyAdd: document.getElementById("empty-add"),
  summary: document.getElementById("customer-summary"),
  search: document.getElementById("search"),
  sideBalance: document.getElementById("side-balance"),
  newCustomer: document.getElementById("new-customer"),
  overlay: document.getElementById("modal-layer"),
  modalTitle: document.getElementById("modal-title"),
  modalDesc: document.getElementById("modal-desc"),
  modalFields: document.getElementById("modal-fields"),
  form: document.getElementById("modal-form"),
  submit: document.getElementById("modal-submit"),
  cancel: document.getElementById("modal-cancel"),
  close: document.getElementById("modal-close"),
  toasts: document.getElementById("toast-stack"),
};

let state = {
  customers: [],
  stats: { customers: 0, accounts: 0, balance: 0, average: 0 },
};
let query = "";
let currentSubmit = null;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- helpers ---------- */

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

const icon = (path, width = 1.8) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

const icons = {
  trash: () => icon('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  plus: () => icon('<path d="M12 5v14M5 12h14"/>', 2),
  deposit: () => icon('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>', 2),
  withdraw: () => icon('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>', 2),
  check: () => icon('<path d="m20 6-11 11-5-5"/>', 2),
  alert: () => icon('<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>'),
};

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function hueFor(name) {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.codePointAt(0)) % 360;
  }
  return hash;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    /* no JSON body */
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data;
}

/* ---------- toasts ---------- */

function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.innerHTML = `
    <span class="toast-icon">${type === "error" ? icons.alert() : icons.check()}</span>
    <span>${esc(message)}</span>`;
  el.toasts.appendChild(node);

  setTimeout(() => {
    node.classList.add("leaving");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  }, 3600);
}

/* ---------- rendering ---------- */

function animateNumber(node, target, isMoney) {
  const end = Number(target) || 0;
  const start = Number(node.dataset.value || 0);
  node.dataset.value = String(end);

  const format = (value) => (isMoney ? money(value) : numberFormatter.format(value));

  if (prefersReducedMotion || start === end) {
    node.textContent = format(end);
    return;
  }

  node.textContent = format(start);

  const duration = 520;
  const started = performance.now();
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    node.textContent = format(end);
  };

  function frame(now) {
    if (finished) return;
    const progress = Math.min((now - started) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = format(Math.round(start + (end - start) * eased));
    if (progress < 1) requestAnimationFrame(frame);
    else finish();
  }

  requestAnimationFrame(frame);
  /* Safety net for throttled/background tabs where rAF may not run. */
  setTimeout(finish, duration + 400);
}

function renderStats() {
  document.querySelectorAll("[data-stat]").forEach((node) => {
    const key = node.dataset.stat;
    animateNumber(node, state.stats[key] ?? 0, node.hasAttribute("data-money"));
  });

  el.sideBalance.textContent = money(state.stats.balance);
}

function accountRow(account) {
  return `
    <div class="account" data-account="${account.account_no}">
      <div class="acc-top">
        <span class="acc-no">•••• ${account.account_no}</span>
        <span class="tag">${esc(account.type)}</span>
      </div>
      <div class="acc-balance">${money(account.balance)}</div>
      <div class="acc-actions">
        <button class="chip-btn deposit" type="button" data-action="deposit">
          ${icons.deposit()} Deposit
        </button>
        <button class="chip-btn withdraw" type="button" data-action="withdraw">
          ${icons.withdraw()} Withdraw
        </button>
        <button class="chip-btn danger" type="button" data-action="delete-account">
          ${icons.trash()} Close
        </button>
      </div>
    </div>`;
}

function customerCard(customer, index) {
  const count = customer.accounts.length;
  const accounts = count
    ? customer.accounts.map(accountRow).join("")
    : `<div class="account-empty">No accounts yet — open one below.</div>`;

  return `
    <article class="customer" data-customer="${customer.id}"
             style="--i:${index}; --hue:${hueFor(customer.name)}">
      <div class="customer-head">
        <div class="avatar" aria-hidden="true">${esc(initials(customer.name))}</div>
        <div class="customer-id">
          <h3 title="${esc(customer.name)}">${esc(customer.name)}</h3>
          <span>Customer #${customer.id}</span>
        </div>
        <button class="icon-btn danger" type="button" data-action="delete-customer"
                title="Remove customer" aria-label="Remove ${esc(customer.name)}">
          ${icons.trash()}
        </button>
      </div>

      <div class="customer-total">
        <span class="label">Total balance</span>
        <strong>${money(customer.total)}</strong>
        <span class="pill">${count} ${count === 1 ? "account" : "accounts"}</span>
      </div>

      <div class="accounts">${accounts}</div>

      <button class="btn btn-ghost full" type="button" data-action="add-account">
        ${icons.plus()} Open new account
      </button>
    </article>`;
}

function filteredCustomers() {
  const search = query.trim().toLowerCase();
  if (!search) return state.customers;

  return state.customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(search) ||
      String(customer.id) === search ||
      String(customer.id).includes(search)
  );
}

function render() {
  renderStats();

  const customers = filteredCustomers();
  const { customers: customerCount, accounts: accountCount } = state.stats;

  el.summary.textContent =
    `${customerCount} ${customerCount === 1 ? "customer" : "customers"} · ` +
    `${accountCount} ${accountCount === 1 ? "account" : "accounts"}`;

  const searching = Boolean(query.trim());
  el.empty.hidden = customers.length > 0;

  if (!customers.length) {
    el.grid.innerHTML = "";
    el.emptyTitle.textContent = searching ? "No matches found" : "No customers yet";
    el.emptyText.textContent = searching
      ? `Nothing matches "${query.trim()}". Try another name or ID.`
      : "Add your first customer to open a profile, create accounts and start moving money.";
    el.emptyAdd.hidden = searching;
    return;
  }

  el.grid.innerHTML = customers.map(customerCard).join("");
}

function renderSkeletons() {
  el.summary.textContent = "Loading…";
  el.grid.innerHTML = Array.from(
    { length: 3 },
    () => `
      <article class="customer skeleton-card" aria-hidden="true">
        <div class="sk sk-title"></div>
        <div class="sk sk-line"></div>
        <div class="sk sk-box"></div>
      </article>`
  ).join("");
}

/* ---------- modal ---------- */

function openModal({ title, desc, field, submitLabel = "Confirm", danger = false, onSubmit }) {
  el.modalTitle.textContent = title;
  el.modalDesc.textContent = desc || "";
  el.modalDesc.hidden = !desc;

  el.submit.textContent = submitLabel;
  el.submit.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;
  el.submit.disabled = false;

  if (field) {
    const maxLength = field.maxlength ? ` maxlength="${field.maxlength}"` : "";
    const prefix = field.prefix ? `<span class="prefix">${esc(field.prefix)}</span>` : "";
    el.modalFields.innerHTML = `
      <div class="field">
        <label for="modal-input">${esc(field.label)}</label>
        <div class="input-wrap">
          ${prefix}
          <input id="modal-input" name="${esc(field.name || "value")}"
                 type="${field.type || "text"}"
                 inputmode="${field.inputmode || "text"}"
                 placeholder="${esc(field.placeholder || "")}"
                 autocomplete="off"${maxLength}>
        </div>
        ${field.hint ? `<span class="hint">${esc(field.hint)}</span>` : ""}
      </div>`;
  } else {
    el.modalFields.innerHTML = "";
  }

  currentSubmit = onSubmit;
  el.overlay.hidden = false;
  document.body.classList.add("modal-open");

  const input = document.getElementById("modal-input");
  setTimeout(() => (input || el.submit).focus(), 30);
}

function closeModal() {
  el.overlay.hidden = true;
  document.body.classList.remove("modal-open");
  el.form.reset();
  el.modalFields.innerHTML = "";
  el.submit.disabled = false;
  el.submit.classList.remove("is-loading");
  currentSubmit = null;
}

function shake(node) {
  const wrap = node.closest(".input-wrap") || node;
  wrap.classList.remove("shake");
  void wrap.offsetWidth;
  wrap.classList.add("shake");
  setTimeout(() => wrap.classList.remove("shake"), 400);
}

el.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const handler = currentSubmit;
  if (!handler) return;

  const input = document.getElementById("modal-input");
  const value = input ? input.value.trim() : "";

  if (input && !value) {
    shake(input);
    input.focus();
    return;
  }

  el.submit.disabled = true;
  el.submit.classList.add("is-loading");

  try {
    await handler(value);
    closeModal();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    if (!el.overlay.hidden) {
      el.submit.disabled = false;
      el.submit.classList.remove("is-loading");
    }
  }
});

el.cancel.addEventListener("click", closeModal);
el.close.addEventListener("click", closeModal);
el.overlay.addEventListener("click", (event) => {
  if (event.target === el.overlay) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el.overlay.hidden) closeModal();
});

/* ---------- actions ---------- */

function promptAddCustomer() {
  openModal({
    title: "New customer",
    desc: "Create a customer profile. A customer ID is assigned automatically.",
    field: {
      label: "Customer name",
      name: "name",
      placeholder: "e.g. Arsal Khan",
      maxlength: MAX_NAME,
      hint: "Up to 60 characters.",
    },
    submitLabel: "Add customer",
    onSubmit: async (name) => {
      const data = await api("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await refresh();
      toast(data.message || "Customer added.");
    },
  });
}

function promptAddAccount(customer) {
  openModal({
    title: "Open new account",
    desc: `A new saving account will be created for ${customer.name}.`,
    submitLabel: "Open account",
    onSubmit: async () => {
      const data = await api(`/api/customers/${customer.id}/accounts`, {
        method: "POST",
      });
      await refresh();
      toast(data.message || "Account opened.");
    },
  });
}

function promptTransaction(customer, account, type) {
  const isDeposit = type === "deposit";

  openModal({
    title: isDeposit ? "Deposit money" : "Withdraw money",
    desc: `${customer.name} · Account ${account.account_no} · Balance ${money(account.balance)}`,
    field: {
      label: `Amount to ${type}`,
      name: "amount",
      type: "number",
      inputmode: "numeric",
      placeholder: "0",
      prefix: CURRENCY,
      hint: "Whole numbers only.",
    },
    submitLabel: isDeposit ? "Deposit" : "Withdraw",
    onSubmit: async (raw) => {
      if (!/^\d+$/.test(raw)) {
        throw new Error("Enter a whole number greater than zero.");
      }

      const amount = Number(raw);
      if (amount <= 0) {
        throw new Error("Enter a whole number greater than zero.");
      }
      if (amount > MAX_AMOUNT) {
        throw new Error(`The maximum amount per transaction is ${money(MAX_AMOUNT)}.`);
      }

      const data = await api(
        `/api/customers/${customer.id}/accounts/${account.account_no}/transaction`,
        {
          method: "POST",
          body: JSON.stringify({ type, amount }),
        }
      );
      await refresh();
      toast(data.message || "Transaction complete.");
    },
  });
}

function promptDeleteCustomer(customer) {
  const count = customer.accounts.length;
  const extra = count
    ? ` This also closes ${count} ${count === 1 ? "account" : "accounts"} holding ${money(customer.total)}.`
    : "";

  openModal({
    title: "Remove customer?",
    desc: `${customer.name} will be permanently removed.${extra}`,
    submitLabel: "Remove customer",
    danger: true,
    onSubmit: async () => {
      const data = await api(`/api/customers/${customer.id}`, { method: "DELETE" });
      await refresh();
      toast(data.message || "Customer removed.");
    },
  });
}

function promptDeleteAccount(customer, account) {
  openModal({
    title: "Close account?",
    desc: `Account ${account.account_no} for ${customer.name} holds ${money(account.balance)}. This cannot be undone.`,
    submitLabel: "Close account",
    danger: true,
    onSubmit: async () => {
      const data = await api(
        `/api/customers/${customer.id}/accounts/${account.account_no}`,
        { method: "DELETE" }
      );
      await refresh();
      toast(data.message || "Account closed.");
    },
  });
}

/* ---------- events ---------- */

el.newCustomer.addEventListener("click", promptAddCustomer);
el.emptyAdd.addEventListener("click", promptAddCustomer);

el.search.addEventListener("input", (event) => {
  query = event.target.value;
  render();
});

el.grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const card = button.closest("[data-customer]");
  if (!card) return;

  const customer = state.customers.find((item) => item.id === Number(card.dataset.customer));
  if (!customer) return;

  const action = button.dataset.action;

  if (action === "delete-customer") {
    promptDeleteCustomer(customer);
    return;
  }

  if (action === "add-account") {
    promptAddAccount(customer);
    return;
  }

  const accountNode = button.closest("[data-account]");
  if (!accountNode) return;

  const account = customer.accounts.find(
    (item) => item.account_no === Number(accountNode.dataset.account)
  );
  if (!account) return;

  if (action === "deposit") promptTransaction(customer, account, "deposit");
  if (action === "withdraw") promptTransaction(customer, account, "withdraw");
  if (action === "delete-account") promptDeleteAccount(customer, account);
});

document.querySelectorAll("[data-nav]").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll("[data-nav]").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

/* ---------- boot ---------- */

async function refresh() {
  state = await api("/api/state");
  render();
}

async function boot() {
  renderSkeletons();

  try {
    await refresh();
  } catch (error) {
    el.grid.innerHTML = "";
    el.empty.hidden = false;
    el.emptyTitle.textContent = "Could not reach the server";
    el.emptyText.textContent = error.message;
    el.emptyAdd.hidden = true;
    toast("Could not load data. Is the Flask server running?", "error");
  }
}

boot();
