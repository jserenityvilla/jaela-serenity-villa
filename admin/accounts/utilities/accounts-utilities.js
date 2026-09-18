document.addEventListener("DOMContentLoaded", async () => {

    const db = window.db || firebase.firestore();

    const tableBody =
        document.getElementById("utilityTableBody");

    const utilityModal =
        document.getElementById("utilityModal");

    const closeUtilityModal =
        document.getElementById("closeUtilityModal");

    const cancelUtility =
        document.getElementById("cancelUtility");

    const utilityModalTitle =
        document.getElementById("utilityModalTitle");

    const utilityForm =
        document.getElementById("utilityForm");

    const addUtilityBill =
        document.getElementById("addUtilityBill");

    const utilityCategory =
        document.getElementById("utilityCategory");

    const utilityBillDate =
        document.getElementById("utilityBillDate");

    const utilityBillingPeriodFrom =
        document.getElementById("utilityBillingPeriodFrom");

    const utilityBillingPeriodTo =
        document.getElementById("utilityBillingPeriodTo");

    const utilityDueDate =
        document.getElementById("utilityDueDate");

    const utilityAmount =
        document.getElementById("utilityAmount");

    const utilityCurrency =
        document.getElementById("utilityCurrency");

    const utilityUsage =
        document.getElementById("utilityUsage");

    const utilityUsageUnit =
        document.getElementById("utilityUsageUnit");

    const utilityClassification =
        document.getElementById("utilityClassification");

    const utilityAllocationMethod =
        document.getElementById("utilityAllocationMethod");

    const utilityAllocationHelp =
        document.getElementById("utilityAllocationHelp");

    const utilityBooking =
        document.getElementById("utilityBooking");

    const utilityBookingGroup =
        document.getElementById("utilityBookingGroup");

    const utilitySupplier =
        document.getElementById("utilitySupplier");

    const utilityReference =
        document.getElementById("utilityReference");

    const utilityDescription =
        document.getElementById("utilityDescription");

    const utilityStatus =
        document.getElementById("utilityStatus");

    const utilitySearch =
        document.getElementById("utilitySearch");

    const utilityCategoryFilter =
        document.getElementById("utilityCategoryFilter");

    const utilityClassificationFilter =
        document.getElementById("utilityClassificationFilter");

    const utilityStatusFilter =
        document.getElementById("utilityStatusFilter");

    const utilityFromDate =
        document.getElementById("utilityFromDate");

    const utilityToDate =
        document.getElementById("utilityToDate");

    const utilitySort =
        document.getElementById("utilitySort");

    const clearUtilityFilters =
        document.getElementById("clearUtilityFilters");

    const utilitySummary =
        document.getElementById("utilitySummary");

    const utilityResultCount =
        document.getElementById("utilityResultCount");

    let utilityBills = [];
    let utilityCategories = [];
    let bookings = [];
    let editingUtilityBillId = null;

    function normalizeText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatAmount(amount) {
        return `AUD ${Number(amount || 0).toFixed(2)}`;
    }

    function getCategory(categoryId) {
        return utilityCategories.find(
            category => category.id === categoryId
        ) || null;
    }

    function getCategoryName(categoryId) {
        const category = getCategory(categoryId);
        return category ? category.name : "Unknown";
    }

    function formatBillingPeriod(bill) {
        if (!bill.billingPeriodFrom &&
            !bill.billingPeriodTo) {
            return "—";
        }

        return `${bill.billingPeriodFrom || "—"} → ${bill.billingPeriodTo || "—"}`;
    }

    function formatBooking(bookingId) {
        if (!bookingId) {
            return "—";
        }

        const booking = bookings.find(
            item => item.id === bookingId
        );

        if (!booking) {
            return "Unknown booking";
        }

        return booking.bookingReference ||
            booking.guestName ||
            booking.id;
    }

    function updateSummary(items) {

        const activeBills =
            items.filter(
                bill => bill.status === "Active"
            );

        const fixedTotal =
            activeBills
                .filter(
                    bill =>
                        bill.expenseClassification ===
                        "Fixed Property"
                )
                .reduce(
                    (sum, bill) =>
                        sum + Number(bill.amount || 0),
                    0
                );

        const variableTotal =
            activeBills
                .filter(
                    bill =>
                        bill.expenseClassification ===
                        "Variable Property"
                )
                .reduce(
                    (sum, bill) =>
                        sum + Number(bill.amount || 0),
                    0
                );

        const otherTotal =
            activeBills
                .filter(
                    bill =>
                        bill.expenseClassification ===
                        "Other"
                )
                .reduce(
                    (sum, bill) =>
                        sum + Number(bill.amount || 0),
                    0
                );

        const activeTotal =
            activeBills.reduce(
                (sum, bill) =>
                    sum + Number(bill.amount || 0),
                0
            );

        utilitySummary.textContent =
            `Active Bills: ${formatAmount(activeTotal)} | ` +
            `Fixed Property: ${formatAmount(fixedTotal)} | ` +
            `Variable Property: ${formatAmount(variableTotal)} | ` +
            `Other: ${formatAmount(otherTotal)}`;
    }

    function populateUtilityControls() {

        utilityCategory.innerHTML =
            '<option value="">Select Utility</option>';

        utilityCategoryFilter.innerHTML =
            '<option value="all">All Utilities</option>';

        utilityCategories
            .sort(
                (a, b) =>
                    Number(a.sortOrder || 0) -
                    Number(b.sortOrder || 0)
            )
            .forEach(category => {

                const option =
                    document.createElement("option");

                option.value = category.id;
                option.textContent = category.name;

                utilityCategory.appendChild(option);

                const filterOption =
                    document.createElement("option");

                filterOption.value = category.id;
                filterOption.textContent = category.name;

                utilityCategoryFilter.appendChild(
                    filterOption
                );
            });
    }

    function populateBookingControls() {

        utilityBooking.innerHTML =
            '<option value="">Select Booking</option>';

        bookings
            .sort(
                (a, b) =>
                    String(a.checkin || "")
                        .localeCompare(
                            String(b.checkin || "")
                        )
            )
            .forEach(booking => {

                const option =
                    document.createElement("option");

                option.value = booking.id;

                option.textContent =
                    `${booking.bookingReference || booking.id} - ` +
                    `${booking.guestName || "Guest"} ` +
                    `(${booking.checkin || "?"} → ${booking.checkout || "?"})`;

                utilityBooking.appendChild(option);
            });
    }

    function renderUtilityBills() {

        const searchTerm =
            utilitySearch.value
                .toLowerCase()
                .trim();

        const selectedCategory =
            utilityCategoryFilter.value;

        const selectedClassification =
            utilityClassificationFilter.value;

        const selectedStatus =
            utilityStatusFilter.value;

        const fromDate =
            utilityFromDate.value;

        const toDate =
            utilityToDate.value;

        let filteredBills =
            utilityBills.filter(bill => {

                const searchableText =
                    [
                        getCategoryName(bill.categoryId),
                        bill.supplier,
                        bill.reference,
                        bill.description,
                        bill.expenseClassification
                    ]
                        .map(value =>
                            String(value || "")
                                .toLowerCase()
                        )
                        .join(" ");

                const matchesSearch =
                    !searchTerm ||
                    searchableText.includes(searchTerm);

                const matchesCategory =
                    selectedCategory === "all" ||
                    bill.categoryId === selectedCategory;

                const matchesClassification =
                    selectedClassification === "all" ||
                    bill.expenseClassification ===
                    selectedClassification;

                const matchesStatus =
                    selectedStatus === "all" ||
                    (
                        selectedStatus === "true" &&
                        bill.status === "Active"
                    ) ||
                    (
                        selectedStatus === "false" &&
                        bill.status === "Cancelled"
                    );

                const matchesFromDate =
                    !fromDate ||
                    String(bill.billDate || "") >= fromDate;

                const matchesToDate =
                    !toDate ||
                    String(bill.billDate || "") <= toDate;

                return (
                    matchesSearch &&
                    matchesCategory &&
                    matchesClassification &&
                    matchesStatus &&
                    matchesFromDate &&
                    matchesToDate
                );
            });

        filteredBills.sort((a, b) => {

            switch (utilitySort.value) {

                case "billDateAsc":
                    return String(a.billDate || "")
                        .localeCompare(
                            String(b.billDate || "")
                        );

                case "amountDesc":
                    return Number(b.amount || 0) -
                        Number(a.amount || 0);

                case "amountAsc":
                    return Number(a.amount || 0) -
                        Number(b.amount || 0);

                case "supplierAsc":
                    return String(a.supplier || "")
                        .localeCompare(
                            String(b.supplier || ""),
                            undefined,
                            { sensitivity: "base" }
                        );

                case "supplierDesc":
                    return String(b.supplier || "")
                        .localeCompare(
                            String(a.supplier || ""),
                            undefined,
                            { sensitivity: "base" }
                        );

                case "billDateDesc":
                default:
                    return String(b.billDate || "")
                        .localeCompare(
                            String(a.billDate || "")
                        );
            }
        });

        tableBody.innerHTML = "";

        utilityResultCount.textContent =
            `Showing ${filteredBills.length} of ` +
            `${utilityBills.length} utility bills`;

        updateSummary(utilityBills);

        if (filteredBills.length === 0) {

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td colspan="8">
                    No utility bills match the current filters.
                </td>
            `;

            tableBody.appendChild(row);

            return;
        }

        filteredBills.forEach(bill => {

            const row =
                document.createElement("tr");

            const statusClass =
                bill.status === "Cancelled"
                    ? "status-cancelled"
                    : "status-active";

            row.innerHTML = `
                <td>${escapeHtml(bill.billDate || "—")}</td>
                <td>${escapeHtml(
                    getCategoryName(bill.categoryId)
                )}</td>
                <td>${escapeHtml(
                    formatBillingPeriod(bill)
                )}</td>
                <td>${escapeHtml(
                    formatAmount(bill.amount)
                )}</td>
                <td>${escapeHtml(
                    bill.supplier || "—"
                )}</td>
                <td>${escapeHtml(
                    bill.expenseClassification || "—"
                )}</td>
                <td>
                    <span class="${statusClass}">
                        ${escapeHtml(bill.status || "Active")}
                    </span>
                </td>
                <td>
                    <button
                        type="button"
                        class="utility-edit-button"
                        data-utility-bill-id="${escapeHtml(
                            bill.id
                        )}">
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
                    "Utility"
                )
                .get();

        utilityCategories =
            snapshot.docs
                .map(doc => {

                    const data = doc.data();

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
                })
                .filter(
                    category => category.active === true
                );

        populateUtilityControls();
    }

    async function loadBookings() {

        const snapshot =
            await db
                .collection("bookings")
                .get();

        bookings =
            snapshot.docs.map(doc => {

                const data = doc.data();

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

    async function loadUtilityBills() {

        try {

            const collectionName =
                CONFIG.firestore.utilityBillsCollection;

            const snapshot =
                await db
                    .collection(collectionName)
                    .get();

            utilityBills =
                snapshot.docs.map(doc => {

                    const data =
                        doc.data();

                    return {
                        id: doc.id,
                        categoryId:
                            data.categoryId || "",
                        billDate:
                            data.billDate || "",
                        billingPeriodFrom:
                            data.billingPeriodFrom || "",
                        billingPeriodTo:
                            data.billingPeriodTo || "",
                        dueDate:
                            data.dueDate || "",
                        amount:
                            Number(data.amount) || 0,
                        currency:
                            data.currency || "AUD",
                        usage:
                            data.usage === null ||
                            data.usage === undefined ||
                            data.usage === ""
                                ? null
                                : Number(data.usage),
                        usageUnit:
                            data.usageUnit || "",
                        expenseClassification:
                            data.expenseClassification ||
                            "Other",
                        allocationMethod:
                            data.allocationMethod || "None",
                        bookingId:
                            data.bookingId || null,
                        supplier:
                            data.supplier || "",
                        reference:
                            data.reference || "",
                        description:
                            data.description || "",
                        status:
                            data.status || "Active",
                        createdAt:
                            data.createdAt || null,
                        updatedAt:
                            data.updatedAt || null
                    };
                });

            renderUtilityBills();

        } catch (error) {

            console.error(
                "Failed to load utility bills:",
                error
            );

            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        Unable to load utility bills.
                    </td>
                </tr>
            `;

        }
    }

    function updateBookingRequirement() {

        const allocation =
            utilityAllocationMethod.value;

        if (allocation === "Direct Booking") {

            utilityBooking.required = true;
            utilityBookingGroup.style.display = "";
            utilityAllocationHelp.textContent =
                "A Booking is required for Direct Booking allocation.";

        } else if (allocation === "Occupied Nights") {

            utilityBooking.required = false;
            utilityBookingGroup.style.display = "";
            utilityAllocationHelp.textContent =
                "Occupied Nights can be allocated across bookings in the billing period.";

        } else {

            utilityBooking.required = false;
            utilityBookingGroup.style.display = "";
            utilityAllocationHelp.textContent =
                "No booking allocation will be applied.";
        }
    }

    function resetUtilityForm() {

        utilityForm.reset();

        utilityCurrency.value = "AUD";
        utilityClassification.value = "Variable Property";
        utilityAllocationMethod.value = "None";
        utilityStatus.value = "Active";
        utilityBooking.value = "";

        updateBookingRequirement();
    }

    function openAddUtilityBillModal() {

        editingUtilityBillId = null;

        resetUtilityForm();

        utilityModalTitle.textContent =
            "Add Utility Bill";

        utilityModal.classList.add("show");
        utilityModal.setAttribute(
            "aria-hidden",
            "false"
        );

        utilityCategory.focus();
    }

    function openEditUtilityBillModal(bill) {

        editingUtilityBillId =
            bill.id;

        utilityModalTitle.textContent =
            "Edit Utility Bill";

        utilityCategory.value =
            bill.categoryId || "";

        utilityBillDate.value =
            bill.billDate || "";

        utilityBillingPeriodFrom.value =
            bill.billingPeriodFrom || "";

        utilityBillingPeriodTo.value =
            bill.billingPeriodTo || "";

        utilityDueDate.value =
            bill.dueDate || "";

        utilityAmount.value =
            bill.amount || "";

        utilityCurrency.value =
            bill.currency || "AUD";

        utilityUsage.value =
            bill.usage === null ||
            bill.usage === undefined
                ? ""
                : bill.usage;

        utilityUsageUnit.value =
            bill.usageUnit || "";

        utilityClassification.value =
            bill.expenseClassification ||
            "Other";

        utilityAllocationMethod.value =
            bill.allocationMethod ||
            "None";

        utilityBooking.value =
            bill.bookingId || "";

        utilitySupplier.value =
            bill.supplier || "";

        utilityReference.value =
            bill.reference || "";

        utilityDescription.value =
            bill.description || "";

        utilityStatus.value =
            bill.status || "Active";

        updateBookingRequirement();

        utilityModal.classList.add("show");
        utilityModal.setAttribute(
            "aria-hidden",
            "false"
        );

        utilityBillDate.focus();
    }

    function closeUtilityModalWindow() {

        utilityModal.classList.remove("show");

        utilityModal.setAttribute(
            "aria-hidden",
            "true"
        );

        editingUtilityBillId = null;
    }

    function validateUtilityFields() {

        if (!utilityCategory.value) {

            alert(
                "Utility Category is required."
            );

            utilityCategory.focus();

            return false;
        }

        if (!utilityBillDate.value) {

            alert(
                "Bill Date is required."
            );

            utilityBillDate.focus();

            return false;
        }

        if (!utilityBillingPeriodFrom.value) {

            alert(
                "Billing Period From is required."
            );

            utilityBillingPeriodFrom.focus();

            return false;
        }

        if (!utilityBillingPeriodTo.value) {

            alert(
                "Billing Period To is required."
            );

            utilityBillingPeriodTo.focus();

            return false;
        }

        if (
            utilityBillingPeriodFrom.value >
            utilityBillingPeriodTo.value
        ) {

            alert(
                "Billing Period From cannot be later than Billing Period To."
            );

            utilityBillingPeriodFrom.focus();

            return false;
        }

        if (!utilityDueDate.value) {

            alert(
                "Due Date is required."
            );

            utilityDueDate.focus();

            return false;
        }

        const amount =
            Number(utilityAmount.value);

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {

            alert(
                "Amount must be greater than zero."
            );

            utilityAmount.focus();

            return false;
        }

        if (amount > 1000000) {

            alert(
                "Amount cannot exceed 1,000,000."
            );

            utilityAmount.focus();

            return false;
        }

        if (
            utilityCurrency.value !==
            "AUD"
        ) {

            alert(
                "Invalid currency."
            );

            utilityCurrency.focus();

            return false;
        }

        const validClassifications = [
            "Fixed Property",
            "Variable Property",
            "Other"
        ];

        if (
            !validClassifications.includes(
                utilityClassification.value
            )
        ) {

            alert(
                "Invalid utility classification."
            );

            utilityClassification.focus();

            return false;
        }

        const validAllocationMethods = [
            "None",
            "Occupied Nights",
            "Direct Booking"
        ];

        if (
            !validAllocationMethods.includes(
                utilityAllocationMethod.value
            )
        ) {

            alert(
                "Invalid allocation method."
            );

            utilityAllocationMethod.focus();

            return false;
        }

        if (
            utilityAllocationMethod.value ===
            "Direct Booking" &&
            !utilityBooking.value
        ) {

            alert(
                "A Booking is required for Direct Booking allocation."
            );

            utilityBooking.focus();

            return false;
        }

        const usageText =
            String(utilityUsage.value || "")
                .trim();

        if (usageText) {

            const usage =
                Number(utilityUsage.value);

            if (
                !Number.isFinite(usage) ||
                usage < 0
            ) {

                alert(
                    "Usage must be zero or greater."
                );

                utilityUsage.focus();

                return false;
            }
        }

        if (
            normalizeText(
                utilityUsageUnit.value
            ).length > 30
        ) {

            alert(
                "Usage Unit cannot exceed 30 characters."
            );

            utilityUsageUnit.focus();

            return false;
        }

        if (
            normalizeText(
                utilitySupplier.value
            ).length > 150
        ) {

            alert(
                "Supplier cannot exceed 150 characters."
            );

            utilitySupplier.focus();

            return false;
        }

        if (
            normalizeText(
                utilityReference.value
            ).length > 150
        ) {

            alert(
                "Reference cannot exceed 150 characters."
            );

            utilityReference.focus();

            return false;
        }

        if (
            normalizeText(
                utilityDescription.value
            ).length > 500
        ) {

            alert(
                "Description cannot exceed 500 characters."
            );

            utilityDescription.focus();

            return false;
        }

        const validStatuses = [
            "Active",
            "Cancelled"
        ];

        if (
            !validStatuses.includes(
                utilityStatus.value
            )
        ) {

            alert(
                "Invalid utility bill status."
            );

            utilityStatus.focus();

            return false;
        }

        return true;
    }

    async function saveUtilityBill() {

        if (!validateUtilityFields()) {
            return;
        }

        const category =
            getCategory(
                utilityCategory.value
            );

        if (
            !category ||
            category.categoryType !== "Utility" ||
            category.active !== true
        ) {

            alert(
                "Please select a valid active Utility category."
            );

            utilityCategory.focus();

            return;
        }

        const duplicate =
            utilityBills.find(bill => {

                if (
                    editingUtilityBillId &&
                    bill.id === editingUtilityBillId
                ) {
                    return false;
                }

                return (
                    bill.status === "Active" &&
                    bill.billDate ===
                        utilityBillDate.value &&
                    bill.categoryId ===
                        utilityCategory.value &&
                    Number(
                        Number(
                            bill.amount || 0
                        ).toFixed(2)
                    ) ===
                        Number(
                            Number(
                                utilityAmount.value
                            ).toFixed(2)
                        ) &&
                    normalizeText(
                        bill.supplier
                    ).toLowerCase() ===
                        normalizeText(
                            utilitySupplier.value
                        ).toLowerCase() &&
                    normalizeText(
                        bill.reference
                    ).toLowerCase() ===
                        normalizeText(
                            utilityReference.value
                        ).toLowerCase()
                );
            });

        if (duplicate) {

            const proceed =
                confirm(
                    "A possible duplicate utility bill was found with the same bill date, utility, amount, supplier and reference.\n\nDo you want to continue?"
                );

            if (!proceed) {
                return;
            }
        }

        const saveButton =
            utilityForm.querySelector(
                'button[type="submit"]'
            );

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {

            const data = {

                categoryId:
                    utilityCategory.value,

                billDate:
                    utilityBillDate.value,

                billingPeriodFrom:
                    utilityBillingPeriodFrom.value,

                billingPeriodTo:
                    utilityBillingPeriodTo.value,

                dueDate:
                    utilityDueDate.value,

                amount:
                    Number(
                        Number(
                            utilityAmount.value
                        ).toFixed(2)
                    ),

                currency:
                    utilityCurrency.value,

                usage:
                    String(
                        utilityUsage.value || ""
                    ).trim() === ""
                        ? null
                        : Number(
                            Number(
                                utilityUsage.value
                            ).toFixed(3)
                        ),

                usageUnit:
                    normalizeText(
                        utilityUsageUnit.value
                    ),

                expenseClassification:
                    utilityClassification.value,

                allocationMethod:
                    utilityAllocationMethod.value,

                bookingId:
                    utilityAllocationMethod.value ===
                    "Direct Booking"
                        ? (
                            utilityBooking.value ||
                            null
                        )
                        : null,

                supplier:
                    normalizeText(
                        utilitySupplier.value
                    ),

                reference:
                    normalizeText(
                        utilityReference.value
                    ),

                description:
                    normalizeText(
                        utilityDescription.value
                    ),

                status:
                    utilityStatus.value,

                updatedAt:
                    firebase.firestore.FieldValue
                        .serverTimestamp()

            };

            const collectionName =
                CONFIG.firestore
                    .utilityBillsCollection;

            if (editingUtilityBillId) {

                await db
                    .collection(collectionName)
                    .doc(editingUtilityBillId)
                    .update(data);

            } else {

                await db
                    .collection(collectionName)
                    .add({
                        ...data,
                        createdAt:
                            firebase.firestore.FieldValue
                                .serverTimestamp()
                    });
            }

            closeUtilityModalWindow();

            await loadUtilityBills();

        } catch (error) {

            console.error(
                "Failed to save utility bill:",
                error
            );

            alert(
                "Unable to save the utility bill. Please try again."
            );

        } finally {

            saveButton.disabled = false;
            saveButton.textContent =
                "Save Utility Bill";
        }
    }

    addUtilityBill.addEventListener(
        "click",
        openAddUtilityBillModal
    );

    closeUtilityModal.addEventListener(
        "click",
        closeUtilityModalWindow
    );

    cancelUtility.addEventListener(
        "click",
        closeUtilityModalWindow
    );

    utilityModal.addEventListener(
        "click",
        event => {

            if (
                event.target === utilityModal
            ) {
                closeUtilityModalWindow();
            }
        }
    );

    utilityAllocationMethod.addEventListener(
        "change",
        updateBookingRequirement
    );

    utilityForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            await saveUtilityBill();
        }
    );

    utilityCategoryFilter.addEventListener(
        "change",
        renderUtilityBills
    );

    utilityClassificationFilter.addEventListener(
        "change",
        renderUtilityBills
    );

    utilityStatusFilter.addEventListener(
        "change",
        renderUtilityBills
    );

    utilitySearch.addEventListener(
        "input",
        renderUtilityBills
    );

    function applyUtilityDateFilter() {

        if (
            utilityFromDate.value &&
            utilityToDate.value &&
            utilityFromDate.value >
            utilityToDate.value
        ) {

            alert(
                "From date cannot be later than To date."
            );

            utilityFromDate.focus();

            return;
        }

        renderUtilityBills();
    }

    utilityFromDate.addEventListener(
        "change",
        applyUtilityDateFilter
    );

    utilityToDate.addEventListener(
        "change",
        applyUtilityDateFilter
    );

    utilitySort.addEventListener(
        "change",
        renderUtilityBills
    );

    clearUtilityFilters.addEventListener(
        "click",
        () => {

            utilitySearch.value = "";
            utilityCategoryFilter.value = "all";
            utilityClassificationFilter.value = "all";
            utilityStatusFilter.value = "all";
            utilityFromDate.value = "";
            utilityToDate.value = "";
            utilitySort.value = "billDateDesc";

            renderUtilityBills();
        }
    );

    tableBody.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-utility-bill-id]"
                );

            if (!button) {
                return;
            }

            const bill =
                utilityBills.find(
                    item =>
                        item.id ===
                        button.dataset.utilityBillId
                );

            if (bill) {
                openEditUtilityBillModal(bill);
            }
        }
    );

    try {

        await loadCategories();
        await loadBookings();
        await loadUtilityBills();

    } catch (error) {

        console.error(
            "Utility Module initialisation failed:",
            error
        );

        tableBody.innerHTML = `
            <tr>
                <td colspan="8">
                    Unable to initialise the Utility Bills module.
                </td>
            </tr>
        `;
    }

});
