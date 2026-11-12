"""Flask web frontend for the Bank Management System.

Run with:  .\\.venv\\Scripts\\python.exe app.py
Then open: http://127.0.0.1:5000

The web app keeps its own in-memory Bank instance, separate from the CLI
(main.py). Data resets when the server stops.
"""

import os
import threading

from flask import Flask, jsonify, render_template, request

from bank import Bank

app = Flask(__name__)

bank = Bank(verbose=False)
lock = threading.Lock()

MAX_NAME_LENGTH = 60
MAX_AMOUNT = 10_000_000


def snapshot():
    """Serialise the bank into JSON-friendly data for the UI."""
    customers = []
    total_accounts = 0
    total_balance = 0

    for holder in bank.customers:
        accounts = [
            {
                "account_no": account.account_no,
                "type": account.account_type,
                "balance": account.balance,
            }
            for account in holder.accounts
        ]
        subtotal = sum(account["balance"] for account in accounts)
        total_accounts += len(accounts)
        total_balance += subtotal
        customers.append(
            {
                "id": holder.customer_id,
                "name": holder.name,
                "accounts": accounts,
                "total": subtotal,
            }
        )

    return {
        "customers": customers,
        "stats": {
            "customers": len(customers),
            "accounts": total_accounts,
            "balance": total_balance,
            "average": total_balance // total_accounts if total_accounts else 0,
        },
    }


def fail(message, status=400):
    return jsonify({"ok": False, "message": message}), status


def json_body():
    return request.get_json(silent=True) or {}


def valid_amount(value):
    return (
        isinstance(value, int)
        and not isinstance(value, bool)
        and 0 < value <= MAX_AMOUNT
    )


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/state")
def get_state():
    with lock:
        return jsonify(snapshot())


@app.post("/api/customers")
def add_customer():
    name = str(json_body().get("name", "")).strip()

    if not name:
        return fail("Customer name is required.")
    if len(name) > MAX_NAME_LENGTH:
        return fail(f"Name cannot be longer than {MAX_NAME_LENGTH} characters.")

    with lock:
        holder = bank.add_customer(name)
        return (
            jsonify(
                {
                    "ok": True,
                    "message": f'Customer "{holder.name}" was added.',
                    "customer_id": holder.customer_id,
                }
            ),
            201,
        )


@app.delete("/api/customers/<int:customer_id>")
def delete_customer(customer_id):
    with lock:
        holder = bank.find_customer(customer_id)
        if holder is None:
            return fail("Customer not found.", 404)

        removed_accounts = len(holder.accounts)
        bank.remove_customer(customer_id)

        message = f'Customer "{holder.name}" was removed.'
        if removed_accounts:
            message = (
                f'Customer "{holder.name}" was removed along with '
                f"{removed_accounts} account(s)."
            )

        return jsonify({"ok": True, "message": message})


@app.post("/api/customers/<int:customer_id>/accounts")
def add_account(customer_id):
    with lock:
        if bank.find_customer(customer_id) is None:
            return fail("Customer not found.", 404)

        account = bank.add_account(customer_id)
        return (
            jsonify(
                {
                    "ok": True,
                    "message": f"Account {account.account_no} was opened.",
                    "account_no": account.account_no,
                }
            ),
            201,
        )


@app.delete("/api/customers/<int:customer_id>/accounts/<int:account_no>")
def delete_account(customer_id, account_no):
    with lock:
        holder = bank.find_customer(customer_id)
        if holder is None:
            return fail("Customer not found.", 404)
        if holder.find_account(account_no) is None:
            return fail("Account not found.", 404)

        bank.remove_account(customer_id, account_no)
        return jsonify({"ok": True, "message": f"Account {account_no} was closed."})


@app.post("/api/customers/<int:customer_id>/accounts/<int:account_no>/transaction")
def transaction(customer_id, account_no):
    data = json_body()
    kind = data.get("type")
    amount = data.get("amount")

    if kind not in ("deposit", "withdraw"):
        return fail("Transaction type must be 'deposit' or 'withdraw'.")
    if not valid_amount(amount):
        return fail("Amount must be a whole number greater than zero.")

    with lock:
        holder = bank.find_customer(customer_id)
        if holder is None:
            return fail("Customer not found.", 404)

        account = holder.find_account(account_no)
        if account is None:
            return fail("Account not found.", 404)

        if kind == "withdraw" and amount > account.balance:
            return fail("Insufficient balance for this withdrawal.")

        if kind == "deposit":
            account.deposit(amount)
            message = f"Deposited {amount} into account {account_no}."
        else:
            account.withdraw(amount)
            message = f"Withdrew {amount} from account {account_no}."

        return jsonify(
            {"ok": True, "message": message, "balance": account.balance}
        )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=False)
