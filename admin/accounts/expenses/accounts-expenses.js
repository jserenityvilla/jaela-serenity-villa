document.addEventListener("DOMContentLoaded", async () => {

    const tableBody =
        document.getElementById("expenseTableBody");

    const expenseModal =
        document.getElementById("expenseModal");

    const expenseModalTitle =
        document.getElementById("expenseModalTitle");

    const closeExpenseModal =
        document.getElementById("closeExpenseModal");

    const cancelExpense =
        document.getElementById("cancelExpense");

    const addExpense =
        document.getElementById("addExpense");

    const expenseForm =
        document.getElementById("expenseForm");

    const expenseDate =
        document.getElementById("expenseDate");

    const expenseCategory =
        document.getElementById("expenseCategory");

    const expenseAmount =
        document.getElementById("expenseAmount");

    const expenseCurrency =
        document.getElementById("expenseCurrency");

    const expenseType =
        document.getElementById("expenseType");

    const expenseBooking =
        document.getElementById("expenseBooking");

    const expenseBookingHelp =
        document.getElementById("expenseBookingHelp");

    const expenseAllocationMethod =
        document.getElementById("expenseAllocationMethod");

    const expenseDescription =
        document.getElementById("expenseDescription");

    const expenseSupplier =
        document.getElementById("expenseSupplier");

    const expenseReference =
        document.getElementById("expenseReference");

    const expenseStatus =
        document.getElementById("expenseStatus");

    const expenseSearch =
        document.getElementById("expenseSearch");

    const expenseCategoryFilter =
        document.getElementById("expenseCategoryFilter");

    const expenseTypeFilter =
        document.getElementById("expenseTypeFilter");

    const expenseStatusFilter =
        document.getElementById("expenseStatusFilter");

    const expenseFromDate =
        document.getElementById("expenseFromDate");

    const expenseToDate =
        document.getElementById("expenseToDate");

    const clearExpenseFilters =
        document.getElementById("clearExpenseFilters");

    const expenseSort =
        document.getElementById("expenseSort");

    const expenseSummary =
        document.getElementById("expenseSummary");

    const expenseResultCount =
        document.getElementById("expenseResultCount");

    let expenses = [];
    let expenseCategories = [];
    let bookings = [];

    let editingExpenseId = null;

    if (window.location.protocol === "file:") {

    }

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }

    function normalizeText(value) {

        return String(value ?? "")
            .replace(/\s+/g, " ")
            .trim();

    }

    function formatAmount(amount, currency) {

        const number =
            Number(amount) || 0;

        return new Intl.NumberFormat(
            "en-AU",
            {
                style: "currency",
                currency: currency || "AUD"
            }
        ).format(number);

    }

    function formatBooking(bookingId) {

        if (!bookingId) {
            return "—";
        }

        const booking =
            bookings.find(
                item => item.id === bookingId
            );

        if (!booking) {
            return "Booking not found";
        }

        return [
            booking.bookingReference || "Booking",
            booking.guestName || "",
            booking.checkin || "",
            booking.checkout || ""
        ].filter(Boolean).join(" | ");

    }

    function getCategory(categoryId) {

        return expenseCategories.find(
            item => item.id === categoryId
        );

    }

    function getCategoryName(categoryId) {

        const category =
            getCategory(categoryId);

        return category
            ? category.name
            : "Unknown category";

    }

    function populateCategoryControls() {

        expenseCategory.innerHTML =
            '<option value="">Select expense category</option>';

        expenseCategoryFilter.innerHTML =
            '<option value="all">All Categories</option>';

        expenseCategories
            .filter(category => category.active)
            .sort(
                (a, b) =>
                    (Number(a.sortOrder) || 0) -
                    (Number(b.sortOrder) || 0)
            )
            .forEach(category => {

                const option =
                    document.createElement("option");

                option.value =
                    category.id;

                option.textContent =
                    category.name;

                expenseCategory.appendChild(
                    option
                );

                const filterOption =
                    option.cloneNode(true);

                expenseCategoryFilter.appendChild(
                    filterOption
                );

            });

    }

    function populateBookingControls() {

        expenseBooking.innerHTML =
            '<option value="">Not linked to a booking</option>';

        bookings
            .slice()
            .sort((a, b) =>
                String(b.checkin || "")
                    .localeCompare(
                        String(a.checkin || "")
                    )
            )
            .forEach(booking => {

                const option =
                    document.createElement("option");

                option.value =
                    booking.id;

                option.textContent = [
                    booking.bookingReference || "Booking",
                    booking.guestName || "",
                    booking.checkin || "",
                    booking.checkout || ""
                ].filter(Boolean).join(" | ");

                expenseBooking.appendChild(
                    option
                );

            });

    }

    function updateBookingRequirement() {


        const bookingSpecific =
            expenseType.value === "Booking-specific";

        expenseBooking.required =
            bookingSpecific;

        expenseBookingHelp.textContent =
            bookingSpecific
                ? "Required for Booking-specific expenses."
                : "Optional. Use this only when the expense is linked to a specific booking.";

        if (bookingSpecific) {

            expenseAllocationMethod.value =
                "Direct Booking";

        } else if (
            expenseAllocationMethod.value === "Direct Booking"
        ) {

            expenseAllocationMethod.value =
                "None";

        }

    }

    function updateSummary() {

        const activeExpenses =
            expenses.filter(
                expense =>
                    expense.status === "Active"
            );

        const total =
            activeExpenses.reduce(
                (sum, expense) =>
                    sum + (Number(expense.amount) || 0),
                0
            );

        const bookingSpecific =
            activeExpenses
                .filter(
                    expense =>
                        expense.expenseType ===
                        "Booking-specific"
                )
                .reduce(
                    (sum, expense) =>
                        sum + (Number(expense.amount) || 0),
                    0
                );

        const variableProperty =
            activeExpenses
                .filter(
                    expense =>
                        expense.expenseType ===
                        "Variable Property"
                )
                .reduce(
                    (sum, expense) =>
                        sum + (Number(expense.amount) || 0),
                    0
                );

        const fixedProperty =
            activeExpenses
                .filter(
                    expense =>
                        expense.expenseType ===
                        "Fixed Property"
                )
                .reduce(
                    (sum, expense) =>
                        sum + (Number(expense.amount) || 0),
                    0
                );

        const other =
            activeExpenses
                .filter(
                    expense =>
                        expense.expenseType === "Other"
                )
                .reduce(
                    (sum, expense) =>
                        sum + (Number(expense.amount) || 0),
                    0
                );

        expenseSummary.textContent =
            [
                `Active Expenses: ${formatAmount(total, "AUD")}`,
                `Booking-specific: ${formatAmount(bookingSpecific, "AUD")}`,
                `Variable Property: ${formatAmount(variableProperty, "AUD")}`,
                `Fixed Property: ${formatAmount(fixedProperty, "AUD")}`,
                `Other: ${formatAmount(other, "AUD")}`
            ].join(" | ");

    }

    function renderExpenses() {

        const selectedCategory =
            expenseCategoryFilter.value;

        const selectedType =
            expenseTypeFilter.value;

        const selectedStatus =
            expenseStatusFilter.value;

        const searchTerm =
            normalizeText(
                expenseSearch.value
            ).toLowerCase();

        const fromDate =
            expenseFromDate.value;

        const toDate =
            expenseToDate.value;

        const filteredExpenses =
            expenses
                .filter(expense => {

                    const matchesCategory =
                        selectedCategory === "all" ||
                        expense.categoryId ===
                            selectedCategory;

                    const matchesType =
                        selectedType === "all" ||
                        expense.expenseType ===
                            selectedType;

                    const matchesStatus =
                        selectedStatus === "all" ||
                        expense.status ===
                            selectedStatus;

                    const bookingText =
                        formatBooking(
                            expense.bookingId
                        ).toLowerCase();

                    const matchesSearch =
                        !searchTerm ||
                        getCategoryName(
                            expense.categoryId
                        ).toLowerCase().includes(
                            searchTerm
                        ) ||
                        String(
                            expense.description || ""
                        ).toLowerCase().includes(
                            searchTerm
                        ) ||
                        String(
                            expense.supplier || ""
                        ).toLowerCase().includes(
                            searchTerm
                        ) ||
                        String(
                            expense.reference || ""
                        ).toLowerCase().includes(
                            searchTerm
                        ) ||
                        bookingText.includes(
                            searchTerm
                        );

                    const matchesFromDate =
                        !fromDate ||
                        String(
                            expense.expenseDate || ""
                        ) >= fromDate;

                    const matchesToDate =
                        !toDate ||
                        String(
                            expense.expenseDate || ""
                        ) <= toDate;

                    return (
                        matchesCategory &&
                        matchesType &&
                        matchesStatus &&
                        matchesSearch &&
                        matchesFromDate &&
                        matchesToDate
                    );

                })
                .sort((a, b) => {

                    switch (expenseSort.value) {

                        case "dateAsc":
                            return String(
                                a.expenseDate || ""
                            ).localeCompare(
                                String(
                                    b.expenseDate || ""
                                )
                            );

                        case "amountDesc":
                            return (
                                (Number(b.amount) || 0) -
                                (Number(a.amount) || 0)
                            );

                        case "amountAsc":
                            return (
                                (Number(a.amount) || 0) -
                                (Number(b.amount) || 0)
                            );

                        case "supplierAsc":
                            return String(
                                a.supplier || ""
                            ).localeCompare(
                                String(
                                    b.supplier || ""
                                ),
                                undefined,
                                { sensitivity: "base" }
                            );

                        case "supplierDesc":
                            return String(
                                b.supplier || ""
                            ).localeCompare(
                                String(
                                    a.supplier || ""
                                ),
                                undefined,
                                { sensitivity: "base" }
                            );

                        case "dateDesc":
                        default:
                            return String(
                                b.expenseDate || ""
                            ).localeCompare(
                                String(
                                    a.expenseDate || ""
                                )
                            );

                    }

                });

        expenseResultCount.textContent =
            `Showing ${filteredExpenses.length} of ${expenses.length} expenses`;

        tableBody.innerHTML = "";

        if (filteredExpenses.length === 0) {

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td colspan="8">
                    No expenses match the current filters.
                </td>
            `;

            tableBody.appendChild(row);

            return;

        }

        filteredExpenses.forEach(expense => {

            const row =
                document.createElement("tr");

            const statusClass =
                expense.status === "Active"
                    ? "status-active"
                    : "status-cancelled";

            row.innerHTML = `
                <td>${escapeHtml(expense.expenseDate || "—")}</td>
                <td>${escapeHtml(getCategoryName(expense.categoryId))}</td>
                <td>${escapeHtml(expense.expenseType || "—")}</td>
                <td>${escapeHtml(formatAmount(expense.amount, expense.currency))}</td>
                <td>${escapeHtml(expense.supplier || "—")}</td>
                <td>${escapeHtml(formatBooking(expense.bookingId))}</td>
                <td>
                    <span class="${statusClass}">
                        ${escapeHtml(expense.status || "Active")}
                    </span>
                </td>
                <td>
                    <button
                        type="button"
                        class="expense-button"
                        data-expense-id="${escapeHtml(expense.id)}">
                        Edit
                    </button>
                </td>
            `;

            tableBody.appendChild(row);

        });

    }

    async function loadCategories() {

        const snapshot =
            await db
                .collection(
                    CONFIG.firestore.categoriesCollection
                )
                .where(
                    "categoryType",
                    "==",
                    "Expense"
                )
                .get();

        expenseCategories =
            snapshot.docs.map(doc => {

                const data =
                    doc.data();

                return {
                    id: doc.id,
                    name: data.name || "",
                    categoryType:
                        data.categoryType || "",
                    description:
                        data.description || "",
                    active:
                        data.active !== false,
                    sortOrder:
                        Number(data.sortOrder) || 0
                };

            });

        populateCategoryControls();

    }

    async function loadBookings() {

        const snapshot =
            await db
                .collection("bookings")
                .get();

        bookings =
            snapshot.docs.map(doc => {

                const data =
                    doc.data();

                return {
                    id: doc.id,
                    bookingReference:
                        data.bookingReference || "",
                    guestName:
                        data.guestName || "",
                    checkin:
                        data.checkin || "",
                    checkout:
                        data.checkout || ""
                };

            });

        populateBookingControls();

    }

    async function loadExpenses() {

        try {

            const snapshot =
                await db
                    .collection(
                        CONFIG.firestore.expensesCollection
                    )
                    .get();

            expenses =
                snapshot.docs.map(doc => {

                    const data =
                        doc.data();

                    return {
                        id: doc.id,
                        expenseDate:
                            data.expenseDate || "",
                        categoryId:
                            data.categoryId || "",
                        amount:
                            Number(data.amount) || 0,
                        currency:
                            data.currency || "AUD",
                        description:
                            data.description || "",
                        supplier:
                            data.supplier || "",
                        reference:
                            data.reference || "",
                        expenseType:
                            data.expenseType || "Other",
                        bookingId:
                            data.bookingId || null,
                        allocationMethod:
                            data.allocationMethod || "None",
                        status:
                            data.status || "Active",
                        createdAt:
                            data.createdAt || null,
                        updatedAt:
                            data.updatedAt || null
                    };

                });

            updateSummary();
            renderExpenses();

        } catch (error) {

            console.error(
                "Failed to load expenses:",
                error
            );

            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        Unable to load expenses.
                    </td>
                </tr>
            `;

        }

    }

    function resetExpenseForm() {

        expenseForm.reset();

        expenseCurrency.value =
            "AUD";

        expenseType.value =
            "Booking-specific";

        expenseAllocationMethod.value =
            "Direct Booking";

        expenseStatus.value =
            "Active";

        updateBookingRequirement();

    }

    function openAddExpenseModal() {

        editingExpenseId = null;

        resetExpenseForm();

        expenseModalTitle.textContent =
            "Add Expense";

        expenseModal.classList.add("show");

        expenseModal.setAttribute(
            "aria-hidden",
            "false"
        );

        expenseDate.focus();

    }

    function openEditExpenseModal(expense) {

        editingExpenseId =
            expense.id;

        expenseModalTitle.textContent =
            "Edit Expense";

        expenseDate.value =
            expense.expenseDate || "";

        expenseCategory.value =
            expense.categoryId || "";

        expenseAmount.value =
            expense.amount || "";

        expenseCurrency.value =
            expense.currency || "AUD";

        expenseType.value =
            expense.expenseType || "Other";

        expenseBooking.value =
            expense.bookingId || "";

        expenseAllocationMethod.value =
            expense.allocationMethod || "None";

        expenseDescription.value =
            expense.description || "";

        expenseSupplier.value =
            expense.supplier || "";

        expenseReference.value =
            expense.reference || "";

        expenseStatus.value =
            expense.status || "Active";

        updateBookingRequirement();

        expenseModal.classList.add("show");

        expenseModal.setAttribute(
            "aria-hidden",
            "false"
        );

        expenseDate.focus();

    }

    function closeExpenseModalWindow() {

        expenseModal.classList.remove("show");

        expenseModal.setAttribute(
            "aria-hidden",
            "true"
        );

        editingExpenseId = null;

    }

    function validateCategory() {

        const category =
            getCategory(
                expenseCategory.value
            );

        if (!category) {

            alert(
                "Please select a valid active expense category."
            );

            expenseCategory.focus();

            return false;

        }

        if (
            category.categoryType !== "Expense" ||
            category.active !== true
        ) {

            alert(
                "Selected category is not an active expense category."
            );

            expenseCategory.focus();

            return false;

        }

        return true;

    }

    function validateExpenseFields() {

        if (!expenseDate.value) {

            alert(
                "Expense Date is required."
            );

            expenseDate.focus();

            return false;

        }

        const amount =
            Number(expenseAmount.value);

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {

            alert(
                "Amount must be greater than zero."
            );

            expenseAmount.focus();

            return false;

        }

        if (amount > 1000000) {

            alert(
                "Amount cannot exceed 1,000,000."
            );

            expenseAmount.focus();

            return false;

        }

        const validTypes = [
            "Booking-specific",
            "Variable Property",
            "Fixed Property",
            "Other"
        ];

        if (
            !validTypes.includes(
                expenseType.value
            )
        ) {

            alert(
                "Invalid Expense Type."
            );

            expenseType.focus();

            return false;

        }

        const validCurrencies = [
            "AUD"
        ];

        if (
            !validCurrencies.includes(
                expenseCurrency.value
            )
        ) {

            alert(
                "Invalid currency."
            );

            expenseCurrency.focus();

            return false;

        }

        const validAllocationMethods = [
            "None",
            "Direct Booking",
            "Occupied Nights"
        ];

        if (
            !validAllocationMethods.includes(
                expenseAllocationMethod.value
            )
        ) {

            alert(
                "Invalid Allocation Method."
            );

            expenseAllocationMethod.focus();

            return false;

        }

        const validStatuses = [
            "Active",
            "Cancelled"
        ];

        if (
            !validStatuses.includes(
                expenseStatus.value
            )
        ) {

            alert(
                "Invalid Expense Status."
            );

            expenseStatus.focus();

            return false;

        }

        if (
            expenseDescription.value.trim().length > 500
        ) {

            alert(
                "Description cannot exceed 500 characters."
            );

            expenseDescription.focus();

            return false;

        }

        if (
            expenseSupplier.value.trim().length > 150
        ) {

            alert(
                "Supplier cannot exceed 150 characters."
            );

            expenseSupplier.focus();

            return false;

        }

        if (
            expenseReference.value.trim().length > 150
        ) {

            alert(
                "Reference cannot exceed 150 characters."
            );

            expenseReference.focus();

            return false;

        }

        if (
            expenseType.value === "Booking-specific" &&
            !expenseBooking.value
        ) {

            alert(
                "A Booking is required for Booking-specific expenses."
            );

            expenseBooking.focus();

            return false;

        }

        if (
            expenseType.value !== "Booking-specific" &&
            expenseAllocationMethod.value ===
                "Direct Booking"
        ) {

            alert(
                "Direct Booking allocation requires a Booking-specific expense."
            );

            expenseAllocationMethod.focus();

            return false;

        }

        if (
            expenseFromDate.value &&
            expenseToDate.value &&
            expenseFromDate.value >
                expenseToDate.value
        ) {

            return false;

        }

        return true;

    }

    function findPossibleDuplicate() {

        const date =
            expenseDate.value;

        const categoryId =
            expenseCategory.value;

        const amount =
            Number(
                Number(expenseAmount.value)
                    .toFixed(2)
            );

        const supplier =
            normalizeText(
                expenseSupplier.value
            ).toLowerCase();

        const reference =
            normalizeText(
                expenseReference.value
            ).toLowerCase();

        return expenses.find(expense => {

            if (
                editingExpenseId &&
                expense.id === editingExpenseId
            ) {
                return false;
            }

            return (
                String(
                    expense.expenseDate || ""
                ) === date &&

                expense.categoryId ===
                    categoryId &&

                Number(
                    Number(expense.amount || 0)
                        .toFixed(2)
                ) === amount &&

                normalizeText(
                    expense.supplier
                ).toLowerCase() ===
                    supplier &&

                normalizeText(
                    expense.reference
                ).toLowerCase() ===
                    reference &&

                expense.status ===
                    "Active"
            );

        });

    }

    addExpense.addEventListener(
        "click",
        openAddExpenseModal
    );

    closeExpenseModal.addEventListener(
        "click",
        closeExpenseModalWindow
    );

    cancelExpense.addEventListener(
        "click",
        closeExpenseModalWindow
    );

    expenseModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                expenseModal
            ) {

                closeExpenseModalWindow();

            }

        }
    );

    expenseType.addEventListener(
        "change",
        updateBookingRequirement
    );

    expenseForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            if (
                !validateExpenseFields()
            ) {
                return;
            }

            if (
                !validateCategory()
            ) {
                return;
            }

            const duplicate =
                findPossibleDuplicate();

            if (duplicate) {

                const proceed =
                    confirm(
                        "A possible duplicate expense was found with the same date, category, amount, supplier and reference.\n\nDo you want to continue?"
                    );

                if (!proceed) {
                    return;
                }

            }

            const saveButton =
                expenseForm.querySelector(
                    'button[type="submit"]'
                );

            saveButton.disabled = true;

            saveButton.textContent =
                "Saving...";

            try {

                const collectionName =
                    CONFIG.firestore.expensesCollection;

                const description =
                    normalizeText(
                        expenseDescription.value
                    );

                const supplier =
                    normalizeText(
                        expenseSupplier.value
                    );

                const reference =
                    normalizeText(
                        expenseReference.value
                    );

                const bookingId =
                    expenseType.value ===
                        "Booking-specific"
                        ? expenseBooking.value
                        : null;

                const allocationMethod =
                    expenseType.value ===
                        "Booking-specific"
                        ? "Direct Booking"
                        : expenseAllocationMethod.value;

                const data = {

                    expenseDate:
                        expenseDate.value,

                    categoryId:
                        expenseCategory.value,

                    amount:
                        Number(
                            Number(expenseAmount.value)
                                .toFixed(2)
                        ),

                    currency:
                        expenseCurrency.value,

                    description:
                        description,

                    supplier:
                        supplier,

                    reference:
                        reference,

                    expenseType:
                        expenseType.value,

                    bookingId:
                        bookingId,

                    allocationMethod:
                        allocationMethod,

                    status:
                        expenseStatus.value,

                    updatedAt:
                        firebase.firestore.FieldValue
                            .serverTimestamp()

                };

                if (editingExpenseId) {

                    await db
                        .collection(
                            collectionName
                        )
                        .doc(
                            editingExpenseId
                        )
                        .update(
                            data
                        );

                } else {

                    await db
                        .collection(
                            collectionName
                        )
                        .add({

                            ...data,

                            createdAt:
                                firebase.firestore.FieldValue
                                    .serverTimestamp()

                        });

                }

                closeExpenseModalWindow();

                await loadExpenses();

            } catch (error) {

                console.error(
                    "Failed to save expense:",
                    error
                );

                alert(
                    "Unable to save the expense. Please try again."
                );

            } finally {

                saveButton.disabled = false;

                saveButton.textContent =
                    "Save Expense";

            }

        }
    );

    expenseCategoryFilter.addEventListener(
        "change",
        renderExpenses
    );

    expenseTypeFilter.addEventListener(
        "change",
        renderExpenses
    );

    expenseStatusFilter.addEventListener(
        "change",
        renderExpenses
    );

    expenseSearch.addEventListener(
        "input",
        renderExpenses
    );

    function applyExpenseDateFilter() {

        if (
            expenseFromDate.value &&
            expenseToDate.value &&
            expenseFromDate.value >
                expenseToDate.value
        ) {

            alert(
                "From date cannot be later than To date."
            );

            expenseFromDate.focus();

            return;
        }

        renderExpenses();
    }

    expenseFromDate.addEventListener(
        "change",
        applyExpenseDateFilter
    );

    expenseToDate.addEventListener(
        "change",
        applyExpenseDateFilter
    );

    expenseSort.addEventListener(
        "change",
        renderExpenses
    );

    clearExpenseFilters.addEventListener(
        "click",
        () => {

            expenseSearch.value =
                "";

            expenseCategoryFilter.value =
                "all";

            expenseTypeFilter.value =
                "all";

            expenseStatusFilter.value =
                "all";

            expenseFromDate.value =
                "";

            expenseToDate.value =
                "";

            expenseSort.value =
                "dateDesc";

            renderExpenses();

        }
    );

    tableBody.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-expense-id]"
                );

            if (!button) {
                return;
            }

            const expense =
                expenses.find(
                    item =>
                        item.id ===
                        button.dataset.expenseId
                );

            if (expense) {
                openEditExpenseModal(
                    expense
                );
            }

        }
    );

    try {

        await loadCategories();

        await loadBookings();

        await loadExpenses();

    } catch (error) {

        console.error(
            "Expense Module initialisation failed:",
            error
        );

        tableBody.innerHTML = `
            <tr>
                <td colspan="8">
                    Unable to initialise the Expense Module.
                </td>
            </tr>
        `;

    }

});
