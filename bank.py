def _is_positive_amount(value):
    """True for a whole number greater than zero (excluding True/False)."""
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


class Bank:

    def __init__(self, verbose=True):
        self.verbose = verbose
        self.customers = []
        self.next_avail_customer_id = 1
        self.next_avail_acc_no = 1000

    def _notify(self, message):
        """Print a CLI message unless the bank is running silently (web API)."""
        if self.verbose:
            print(message)

    def add_customer(self, name):
        name = name.strip()
        if not name:
            self._notify("Customer name cannot be empty")
            return None

        customer_id = self.next_avail_customer_id
        acc_holder = AccountHolder(name, customer_id, verbose=self.verbose)
        self.customers.append(acc_holder)
        self.next_avail_customer_id += 1
        self._notify(f"Customer Added with Customer ID : {customer_id}")
        return acc_holder

    def display_customer(self):
        if not self.customers:
            print("No Customers")
            return

        for cust in self.customers:
            print(cust)
            print()

    def find_customer(self, ID):
        for cust in self.customers:
            if cust.customer_id == ID:
                return cust

        return None

    def remove_customer(self, ID):
        customer = self.find_customer(ID)
        if customer is None:
            self._notify("Customer not exist")
            return False

        self.customers.remove(customer)
        if customer.accounts:
            self._notify(f"Customer removed along with {len(customer.accounts)} account(s)")
        else:
            self._notify("Customer removed")
        return True

    def add_account(self, ID):
        customer = self.find_customer(ID)

        if customer is None:
            self._notify("Customer not exist")
            return None

        balance = 0
        account_typ = "Saving"
        acc_no = self.next_avail_acc_no
        account = Account(acc_no, account_typ, balance, verbose=self.verbose)

        customer.add_account(account)
        self.next_avail_acc_no += 1
        self._notify(
            f"{account_typ} Account with Account no : {acc_no} has been successfully created for Customer ID : {ID}"
        )
        return account

    def remove_account(self, ID, Acc_no):
        customer = self.find_customer(ID)

        if customer is None:
            self._notify("Customer not exist")
            return False

        result = customer.remove_account(Acc_no)

        if result:
            self._notify("Account removed successfully")

        return result

    def display_accounts(self, ID):
        customer = self.find_customer(ID)

        if customer is None:
            print("Customer not exist")
            return

        customer.display_accounts()

    def deposit_amount(self, ID, Acc, Amount):
        customer = self.find_customer(ID)

        if customer is None:
            self._notify("Customer not exist")
            return False

        account = customer.find_account(Acc)

        if account is None:
            self._notify("No Account Exist")
            return False

        return account.deposit(Amount)

    def withdraw_amount(self, ID, Acc, Amount):
        customer = self.find_customer(ID)

        if customer is None:
            self._notify("Customer not exist")
            return False

        account = customer.find_account(Acc)

        if account is None:
            self._notify("No Account Exist")
            return False

        return account.withdraw(Amount)


class Account:

    def __init__(self, account_no, account_type, balance, verbose=True):
        if not _is_positive_amount(account_no):
            raise ValueError("Account number must be a positive whole number")

        if not isinstance(account_type, str) or not account_type.strip():
            raise ValueError("Account type cannot be empty")

        if not isinstance(balance, int) or isinstance(balance, bool) or balance < 0:
            raise ValueError("Opening balance cannot be negative")

        self.verbose = verbose
        self.account_no = account_no
        self.account_type = account_type
        self.balance = balance

    def _notify(self, message):
        if self.verbose:
            print(message)

    def __str__(self):
        return f"Account No : {self.account_no}\nAccount Type : {self.account_type}\nBalance : {self.balance}"

    def __repr__(self):
        return self.__str__()

    def display(self):
        print(self)

    def deposit(self, amount):
        if not _is_positive_amount(amount):
            self._notify("Invalid amount. Please enter a positive whole number")
            return False

        self.balance += amount
        self._notify(f"Your account has been credited by {amount}\nAvail Balance : {self.balance}")
        return True

    def withdraw(self, amount):
        if not _is_positive_amount(amount):
            self._notify("Invalid amount. Please enter a positive whole number")
            return False

        if amount > self.balance:
            self._notify("Insufficient Balance in Account")
            return False

        self.balance -= amount
        self._notify(f"Your account has been debited by {amount}\nAvail Balance : {self.balance}")
        return True


class AccountHolder:

    def __init__(self, name, customer_id, verbose=True):
        self.verbose = verbose
        self.name = name
        self.customer_id = customer_id
        self.accounts = []

    def _notify(self, message):
        if self.verbose:
            print(message)

    def __str__(self):
        if self.accounts:
            accounts = "\n".join(
                "\n".join(f"  {line}" for line in str(acc).splitlines())
                for acc in self.accounts
            )
        else:
            accounts = "  None"
        return f"Account Name : {self.name}\nCustomer Id : {self.customer_id}\nAccounts :\n{accounts}"

    def add_account(self, acc_obj):
        self.accounts.append(acc_obj)

    def remove_account(self, acc_no):

        for acc in self.accounts:
            if acc.account_no == acc_no:
                self.accounts.remove(acc)
                return True

        self._notify("Account not found")
        return False

    def find_account(self, acc_no):
        for acc in self.accounts:
            if acc.account_no == acc_no:
                return acc

        return None

    def display_accounts(self):

        if not self.accounts:
            print("No Account exist")

        else:
            for acc in self.accounts:
                print(acc)
                print()
