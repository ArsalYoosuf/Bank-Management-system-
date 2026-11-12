from bank import Bank

MENU = """========= BANK MENU =========

    1. Add Customer
    2. Display Customers
    3. Remove Customer
    4. Add Account
    5. Display Accounts
    6. Remove Account
    7. Deposit Amount
    8. Withdraw Amount
    9. Exit

    ===================================="""


def read_text(prompt):
    """Read a non-empty line, re-prompting until the input is valid."""
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("Input cannot be empty. Please try again.")


def read_int(prompt):
    """Read a whole number, re-prompting until the input is valid."""
    while True:
        raw = input(prompt).strip()
        try:
            return int(raw)
        except ValueError:
            print("Please enter a whole number (for example 12).")


def read_amount(prompt):
    """Read a whole number greater than zero."""
    while True:
        amount = read_int(prompt)
        if amount > 0:
            return amount
        print("Amount must be greater than zero.")


def read_yes_no(prompt):
    """Read a yes/no answer."""
    while True:
        answer = input(prompt).strip().lower()
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("Please answer 'y' or 'n'.")


def pause():
    input("Press Enter to return to the main menu...")
    print()


def find_customer(bank, prompt):
    """Ask for a customer ID and return the customer, or print an error."""
    customer_id = read_int(prompt)
    customer = bank.find_customer(customer_id)

    if customer is None:
        print("Customer not exist")

    return customer


def remove_customer(bank):
    customer = find_customer(bank, "Enter the Customer ID: ")

    if customer is None:
        return

    if customer.accounts:
        total = sum(account.balance for account in customer.accounts)
        print(f"This customer has {len(customer.accounts)} account(s) with a total balance of {total}.")
        if not read_yes_no("Remove the customer and all accounts? (y/n): "):
            print("Removal cancelled")
            return

    bank.remove_customer(customer.customer_id)
    pause()


def main():
    bank = Bank()

    try:
        while True:
            print(MENU)
            choice = input("Enter your choice: ").strip()

            if choice == "1":
                name = read_text("Enter the Name of Customer: ")
                if bank.add_customer(name):
                    pause()

            elif choice == "2":
                bank.display_customer()
                pause()

            elif choice == "3":
                remove_customer(bank)

            elif choice == "4":
                customer_id = read_int("Enter the Customer ID provided by Bank: ")
                if bank.add_account(customer_id):
                    pause()

            elif choice == "5":
                customer = find_customer(bank, "Enter the Customer ID: ")
                if customer is not None:
                    bank.display_accounts(customer.customer_id)
                    pause()

            elif choice == "6":
                customer = find_customer(bank, "Enter the Customer ID: ")
                if customer is not None:
                    account_no = read_int("Enter the Account No: ")
                    if bank.remove_account(customer.customer_id, account_no):
                        pause()

            elif choice == "7":
                customer = find_customer(bank, "Enter the Customer ID: ")
                if customer is not None:
                    account_no = read_int("Enter the Account No: ")
                    amount = read_amount("Enter the Amount for deposit: ")
                    if bank.deposit_amount(customer.customer_id, account_no, amount):
                        pause()

            elif choice == "8":
                customer = find_customer(bank, "Enter the Customer ID: ")
                if customer is not None:
                    account_no = read_int("Enter the Account No: ")
                    amount = read_amount("Enter the Amount for withdrawal: ")
                    if bank.withdraw_amount(customer.customer_id, account_no, amount):
                        pause()

            elif choice == "9":
                print("Thank you, visit again!")
                break

            else:
                print(f"Invalid choice: '{choice}'. Please enter a number from 1 to 9.")

    except (KeyboardInterrupt, EOFError):
        print("\nExiting. Goodbye!")


if __name__ == "__main__":
    main()
