(function () {
    "use strict";

    let db = null;
    let allPayments = [];
    let allBookings = [];
    let bookingMap = new Map();

    const money = (value, currency = "AUD") => {
        const amount = Number(value) || 0;

        return `${currency || "AUD"} $${amount.toFixed(2)}`;
    };

    const number = (value) => {
        const amount = Number(value);

        return Number.isFinite(amount)
            ? amount
            : 0;
    };

    const text = (value) => String(value ?? "").trim();

    const escapeHtml = (value) => {
        return text(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const todayLocal = () => {
        const date = new Date();

        const year = date.getFullYear();
        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");
        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    };

    const parseDate = (value) => {
        if (!value) {
            return null;
        }

        const parts = String(value).split("-");

        if (parts.length === 3) {
            const year = Number(parts[0]);
            const month = Number(parts[1]) - 1;
            const day = Number(parts[2]);

            const date = new Date(
                year,
                month,
                day
            );

            if (!Number.isNaN(date.getTime())) {
                return date;
            }
        }

        const parsed = new Date(value);

        return Number.isNaN(parsed.getTime())
            ? null
            : parsed;
    };

    const formatDate = (value) => {
        const date = parseDate(value);

        if (!date) {
            return "";
        }

        return date.toLocaleDateString(
            "en-AU",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );
    };

    const statusClass = (status) => {
        return String(status || "Pending")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/\//g, "-");
    };

    const getBooking = (payment) => {
        return bookingMap.get(payment.bookingId) || null;
    };

    const getBookingReference = (payment) => {
        const booking = getBooking(payment);

        return text(
            payment.bookingReference ||
            booking?.bookingReference ||
            payment.bookingId ||
            ""
        );
    };

    const getGuestName = (payment) => {
        const booking = getBooking(payment);

        return text(
            booking?.guestName ||
            payment.guestName ||
            ""
        );
    };

    const getCurrency = (payment) => {
        const booking = getBooking(payment);

        return text(
            payment.currency ||
            booking?.currency ||
            "AUD"
        );
    };

    const getFilters = () => {
        return {
            dateFrom:
                document.getElementById("dateFrom")?.value || "",

            dateTo:
                document.getElementById("dateTo")?.value || "",

            paymentType:
                document.getElementById("paymentType")?.value || "",

            paymentStatus:
                document.getElementById("paymentStatus")?.value || "",

            paymentMethod:
                document.getElementById("paymentMethod")?.value || "",

            search: (
                document.getElementById("searchText")?.value || ""
            ).trim().toLowerCase()
        };
    };

    const paymentInDateRange = (payment, filters) => {
        if (!filters.dateFrom && !filters.dateTo) {
            return true;
        }

        const paymentDate = parseDate(
            payment.paymentDate
        );

        if (!paymentDate) {
            return false;
        }

        if (filters.dateFrom) {
            const from = parseDate(filters.dateFrom);

            if (from && paymentDate < from) {
                return false;
            }
        }

        if (filters.dateTo) {
            const to = parseDate(filters.dateTo);

            if (to) {
                to.setHours(
                    23,
                    59,
                    59,
                    999
                );

                if (paymentDate > to) {
                    return false;
                }
            }
        }

        return true;
    };

    const matchesSearch = (payment, search) => {
        if (!search) {
            return true;
        }

        const booking = getBooking(payment);

        const reference =
            getBookingReference(payment)
                .toLowerCase();

        const guest =
            getGuestName(payment)
                .toLowerCase();

        const email =
            text(
                booking?.email ||
                payment.email
            ).toLowerCase();

        const transactionReference =
            text(
                payment.transactionReference
            ).toLowerCase();

        return (
            reference.includes(search) ||
            guest.includes(search) ||
            email.includes(search) ||
            transactionReference.includes(search)
        );
    };

    const applyFilters = () => {
        const filters = getFilters();

        return allPayments.filter(payment => {

            if (
                filters.paymentType &&
                payment.paymentType !==
                    filters.paymentType
            ) {
                return false;
            }

            if (
                filters.paymentStatus &&
                payment.paymentStatus !==
                    filters.paymentStatus
            ) {
                return false;
            }

            if (
                filters.paymentMethod &&
                payment.paymentMethod !==
                    filters.paymentMethod
            ) {
                return false;
            }

            if (
                !paymentInDateRange(
                    payment,
                    filters
                )
            ) {
                return false;
            }

            if (
                !matchesSearch(
                    payment,
                    filters.search
                )
            ) {
                return false;
            }

            return true;
        });
    };

    const getCompletedPositivePayments = payments => {
        return payments.filter(
            payment =>
                payment.paymentStatus ===
                    "Completed" &&
                number(payment.amount) > 0
        );
    };

    const getCompletedRefunds = payments => {
        return payments.filter(
            payment =>
                payment.paymentStatus ===
                    "Completed" &&
                (
                    payment.paymentType ===
                        "Refund" ||
                    number(payment.amount) < 0
                )
        );
    };

    const getNetReceived = payments => {
        return payments
            .filter(
                payment =>
                    payment.paymentStatus ===
                    "Completed"
            )
            .reduce(
                (total, payment) =>
                    total + number(payment.amount),
                0
            );
    };

    const getTotalRefunded = payments => {
        return getCompletedRefunds(
            payments
        ).reduce(
            (total, payment) =>
                total +
                Math.abs(
                    number(payment.amount)
                ),
            0
        );
    };

    const getOutstandingForBookings = payments => {
        const bookingIds = new Set();

        payments.forEach(payment => {
            if (payment.bookingId) {
                bookingIds.add(
                    payment.bookingId
                );
            }
        });

        let outstanding = 0;

        bookingIds.forEach(bookingId => {
            const booking =
                bookingMap.get(bookingId);

            if (!booking) {
                return;
            }

            const bookingTotal =
                number(booking.total);

            const bookingPayments =
                allPayments.filter(
                    payment =>
                        payment.bookingId ===
                            bookingId &&
                        payment.paymentStatus ===
                            "Completed"
                );

            const netReceived =
                bookingPayments.reduce(
                    (total, payment) =>
                        total +
                        number(payment.amount),
                    0
                );

            outstanding += Math.max(
                0,
                bookingTotal -
                    netReceived
            );
        });

        return outstanding;
    };

    const renderSummary = payments => {
        const completed =
            payments.filter(
                payment =>
                    payment.paymentStatus ===
                    "Completed"
            );

        const pending =
            payments.filter(
                payment =>
                    payment.paymentStatus ===
                    "Pending"
            );

        const refunds =
            getCompletedRefunds(
                payments
            );

        const positiveReceived =
            getCompletedPositivePayments(
                payments
            ).reduce(
                (total, payment) =>
                    total +
                    number(payment.amount),
                0
            );

        const refunded =
            getTotalRefunded(
                payments
            );

        const netReceived =
            getNetReceived(
                payments
            );

        const outstanding =
            getOutstandingForBookings(
                payments
            );

        document.getElementById(
            "totalPayments"
        ).textContent =
            payments.length.toString();

        document.getElementById(
            "completedPayments"
        ).textContent =
            completed.length.toString();

        document.getElementById(
            "pendingPayments"
        ).textContent =
            pending.length.toString();

        document.getElementById(
            "refunds"
        ).textContent =
            refunds.length.toString();

        document.getElementById(
            "totalReceived"
        ).textContent =
            money(positiveReceived);

        document.getElementById(
            "totalRefunded"
        ).textContent =
            money(refunded);

        document.getElementById(
            "netReceived"
        ).textContent =
            money(netReceived);

        document.getElementById(
            "outstandingAmount"
        ).textContent =
            money(outstanding);
    };

    const renderRows = payments => {
        const tbody =
            document.getElementById(
                "paymentsBody"
            );

        if (!payments.length) {
            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="10"
                        class="empty-state"
                    >
                        No payment transactions
                        match the current filters.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML =
            payments.map(payment => {

                const currency =
                    getCurrency(payment);

                const amount =
                    number(payment.amount);

                const isRefund =
                    payment.paymentType ===
                        "Refund" ||
                    amount < 0;

                return `
                    <tr>
                        <td>
                            ${escapeHtml(
                                formatDate(
                                    payment.paymentDate
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                getBookingReference(
                                    payment
                                ) || "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                getGuestName(
                                    payment
                                ) || "—"
                            )}
                        </td>

                        <td>
                            <span class="type-pill">
                                ${escapeHtml(
                                    payment.paymentType ||
                                    "—"
                                )}
                            </span>
                        </td>

                        <td class="numeric ${
                            isRefund
                                ? "refund-amount"
                                : ""
                        }">
                            ${escapeHtml(
                                money(
                                    amount,
                                    currency
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                payment.paymentMethod ||
                                "—"
                            )}
                        </td>

                        <td>
                            <span
                                class="status status-${
                                    statusClass(
                                        payment.paymentStatus
                                    )
                                }"
                            >
                                ${escapeHtml(
                                    payment.paymentStatus ||
                                    "—"
                                )}
                            </span>
                        </td>

                        <td>
                            ${escapeHtml(
                                payment.transactionReference ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                payment.description ||
                                "—"
                            )}
                        </td>

                        <td>
                            <button
                                type="button"
                                class="btn-small"
                                data-payment-id="${
                                    escapeHtml(
                                        payment.id
                                    )
                                }"
                            >
                                View
                            </button>
                        </td>
                    </tr>
                `;
            }).join("");
    };

    const getCompletedNetForBooking =
        bookingId => {
            return allPayments
                .filter(
                    payment =>
                        payment.bookingId ===
                            bookingId &&
                        payment.paymentStatus ===
                            "Completed"
                )
                .reduce(
                    (total, payment) =>
                        total +
                        number(payment.amount),
                    0
                );
        };

    const setRecordMessage = (
        message,
        type
    ) => {
        const element =
            document.getElementById(
                "recordPaymentMessage"
            );

        if (!message) {
            element.hidden = true;
            element.textContent = "";
            element.className =
                "record-payment-message";

            return;
        }

        element.textContent = message;
        element.hidden = false;
        element.className =
            `record-payment-message ${type || ""}`;
    };

    const getRecordBooking = () => {
        const bookingId =
            document.getElementById(
                "recordBookingId"
            ).value;

        return bookingMap.get(
            bookingId
        ) || null;
    };

    const renderBookingOptions = () => {
        const select =
            document.getElementById(
                "recordBookingId"
            );

        if (!select) {
            return;
        }

        const currentValue =
            select.value;

        const sortedBookings =
            [...allBookings].sort(
                (a, b) =>
                    text(
                        a.bookingReference ||
                        a.id
                    ).localeCompare(
                        text(
                            b.bookingReference ||
                            b.id
                        )
                    )
            );

        select.innerHTML = `
            <option value="">
                Select booking
            </option>
        `;

        sortedBookings.forEach(
            booking => {
                const reference =
                    text(
                        booking.bookingReference ||
                        booking.id
                    );

                const guest =
                    text(
                        booking.guestName
                    ) || "No guest";

                const currency =
                    text(
                        booking.currency
                    ) || "AUD";

                const total =
                    number(booking.total);

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    booking.id;

                option.textContent =
                    `${reference} — ` +
                    `${guest} — ` +
                    `${money(total, currency)} ` +
                    `(${text(booking.status) || "—"})`;

                select.appendChild(
                    option
                );
            }
        );

        if (
            currentValue &&
            bookingMap.has(currentValue)
        ) {
            select.value =
                currentValue;
        }
    };

    const updateRecordBookingContext =
        () => {
            const booking =
                getRecordBooking();

            const referenceElement =
                document.getElementById(
                    "recordBookingReference"
                );

            const guestElement =
                document.getElementById(
                    "recordGuestName"
                );

            const totalElement =
                document.getElementById(
                    "recordBookingTotal"
                );

            const currentReceivedElement =
                document.getElementById(
                    "recordCurrentReceived"
                );

            const currentOutstandingElement =
                document.getElementById(
                    "recordCurrentOutstanding"
                );

            const currencyInput =
                document.getElementById(
                    "recordCurrency"
                );

            if (!booking) {
                referenceElement.textContent =
                    "—";

                guestElement.textContent =
                    "—";

                totalElement.textContent =
                    "AUD $0.00";

                currentReceivedElement.textContent =
                    "AUD $0.00";

                currentOutstandingElement.textContent =
                    "AUD $0.00";

                return;
            }

            const currency =
                text(
                    booking.currency
                ) || "AUD";

            const total =
                number(booking.total);

            const currentNet =
                getCompletedNetForBooking(
                    booking.id
                );

            const currentOutstanding =
                Math.max(
                    0,
                    total -
                        currentNet
                );

            referenceElement.textContent =
                text(
                    booking.bookingReference ||
                    booking.id
                ) || "—";

            guestElement.textContent =
                text(
                    booking.guestName
                ) || "—";

            totalElement.textContent =
                money(
                    total,
                    currency
                );

            currentReceivedElement.textContent =
                money(
                    currentNet,
                    currency
                );

            currentOutstandingElement.textContent =
                money(
                    currentOutstanding,
                    currency
                );

            if (
                currencyInput &&
                !currencyInput.value.trim()
            ) {
                currencyInput.value =
                    currency;
            }
        };

    const updateRecordProjection =
        () => {
            const booking =
                getRecordBooking();

            const projectedReceivedElement =
                document.getElementById(
                    "recordProjectedReceived"
                );

            const projectedOutstandingElement =
                document.getElementById(
                    "recordProjectedOutstanding"
                );

            const type =
                document.getElementById(
                    "recordPaymentType"
                ).value;

            const status =
                document.getElementById(
                    "recordPaymentStatus"
                ).value;

            const amount =
                Math.abs(
                    number(
                        document.getElementById(
                            "recordAmount"
                        ).value
                    )
                );

            if (!booking) {
                projectedReceivedElement.textContent =
                    "AUD $0.00";

                projectedOutstandingElement.textContent =
                    "AUD $0.00";

                return;
            }

            const currency =
                text(
                    booking.currency
                ) || "AUD";

            const currentNet =
                getCompletedNetForBooking(
                    booking.id
                );

            const storedAmount =
                type === "Refund"
                    ? -amount
                    : amount;

            const projectedNet =
                status === "Completed"
                    ? currentNet +
                        storedAmount
                    : currentNet;

            const projectedOutstanding =
                Math.max(
                    0,
                    number(booking.total) -
                        projectedNet
                );

            projectedReceivedElement.textContent =
                money(
                    projectedNet,
                    currency
                );

            projectedOutstandingElement.textContent =
                money(
                    projectedOutstanding,
                    currency
                );
        };

    const updateRefundHelp = () => {
        const type =
            document.getElementById(
                "recordPaymentType"
            ).value;

        document.getElementById(
            "refundHelp"
        ).hidden =
            type !== "Refund";
    };

    const resetRecordForm = () => {
        const form =
            document.getElementById(
                "recordPaymentForm"
            );

        form.reset();

        document.getElementById(
            "recordPaymentDate"
        ).value =
            todayLocal();

        document.getElementById(
            "recordPaymentStatus"
        ).value =
            "Completed";

        document.getElementById(
            "recordCurrency"
        ).value =
            "AUD";

        setRecordMessage(
            "",
            ""
        );

        updateRefundHelp();
        updateRecordBookingContext();
        updateRecordProjection();
    };

    const openRecordPayment =
        () => {
            const panel =
                document.getElementById(
                    "recordPaymentPanel"
                );

            panel.hidden = false;

            resetRecordForm();

            panel.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            setTimeout(() => {
                document.getElementById(
                    "recordBookingId"
                )?.focus();
            }, 200);
        };

    const closeRecordPayment =
        () => {
            const panel =
                document.getElementById(
                    "recordPaymentPanel"
                );

            panel.hidden = true;

            setRecordMessage(
                "",
                ""
            );
        };

    const savePayment = async event => {
        event.preventDefault();

        const saveButton =
            document.getElementById(
                "savePaymentButton"
            );

        try {
            saveButton.disabled = true;

            setRecordMessage(
                "Validating payment...",
                ""
            );

            const utils =
                window.AccountsPaymentsUtils;

            if (!utils) {
                throw new Error(
                    "Payment validation utilities are not loaded."
                );
            }

            const booking =
                getRecordBooking();

            if (!booking) {
                throw new Error(
                    "Please select a booking."
                );
            }

            const paymentDate =
                document.getElementById(
                    "recordPaymentDate"
                ).value;

            const paymentType =
                document.getElementById(
                    "recordPaymentType"
                ).value;

            const enteredAmount =
                Math.abs(
                    number(
                        document.getElementById(
                            "recordAmount"
                        ).value
                    )
                );

            const currency =
                text(
                    document.getElementById(
                        "recordCurrency"
                    ).value
                ).toUpperCase();

            const paymentMethod =
                document.getElementById(
                    "recordPaymentMethod"
                ).value;

            const paymentStatus =
                document.getElementById(
                    "recordPaymentStatus"
                ).value;

            const transactionReference =
                text(
                    document.getElementById(
                        "recordTransactionReference"
                    ).value
                );

            const description =
                text(
                    document.getElementById(
                        "recordDescription"
                    ).value
                );

            const notes =
                text(
                    document.getElementById(
                        "recordNotes"
                    ).value
                );

            const storedAmount =
                paymentType === "Refund"
                    ? -enteredAmount
                    : enteredAmount;

            const payment = {
                bookingId: booking.id,

                bookingReference: text(
                    booking.bookingReference ||
                    booking.id
                ),

                paymentDate,

                paymentType,

                amount: storedAmount,

                currency,

                paymentMethod,

                paymentStatus,

                transactionReference,

                description,

                notes,

                createdAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp(),

                updatedAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()
            };

            const validation =
                utils.validatePayment(
                    payment
                );

            if (!validation.valid) {
                throw new Error(
                    validation.error ||
                    "Payment validation failed."
                );
            }

            if (
                paymentStatus ===
                    "Completed" &&
                transactionReference &&
                utils.isDuplicateTransactionReference(
                    allPayments,
                    transactionReference
                )
            ) {
                throw new Error(
                    "The transaction reference already exists on another completed payment."
                );
            }

            await db
                .collection("payments")
                .add(payment);

            await refresh();

            renderBookingOptions();

            document.getElementById(
                "recordBookingId"
            ).value =
                booking.id;

            updateRecordBookingContext();
            updateRecordProjection();

            setRecordMessage(
                "Payment recorded successfully.",
                "success"
            );

            document.getElementById(
                "recordAmount"
            ).value = "";

            document.getElementById(
                "recordTransactionReference"
            ).value = "";

            document.getElementById(
                "recordDescription"
            ).value = "";

            document.getElementById(
                "recordNotes"
            ).value = "";

            updateRecordProjection();

        } catch (error) {
            console.error(
                "Record payment failed:",
                error
            );

            setRecordMessage(
                error.message ||
                "Unable to record payment.",
                "error"
            );
        } finally {
            saveButton.disabled =
                false;
        }
    };

    const showPaymentDetails =
        paymentId => {
            const payment =
                allPayments.find(
                    item =>
                        item.id ===
                        paymentId
                );

            if (!payment) {
                return;
            }

            const booking =
                getBooking(payment);

            const details = [
                `Payment ID: ${payment.id}`,
                `Booking: ${
                    getBookingReference(
                        payment
                    ) || "—"
                }`,
                `Guest: ${
                    getGuestName(
                        payment
                    ) || "—"
                }`,
                `Date: ${
                    formatDate(
                        payment.paymentDate
                    ) || "—"
                }`,
                `Type: ${
                    payment.paymentType ||
                    "—"
                }`,
                `Amount: ${
                    money(
                        payment.amount,
                        getCurrency(
                            payment
                        )
                    )
                }`,
                `Method: ${
                    payment.paymentMethod ||
                    "—"
                }`,
                `Status: ${
                    payment.paymentStatus ||
                    "—"
                }`,
                `Transaction Reference: ${
                    payment.transactionReference ||
                    "—"
                }`,
                `Description: ${
                    payment.description ||
                    "—"
                }`
            ];

            if (payment.notes) {
                details.push(
                    `Notes: ${payment.notes}`
                );
            }

            if (booking) {
                details.push(
                    `Booking Total: ${
                        money(
                            booking.total,
                            booking.currency ||
                            "AUD"
                        )
                    }`
                );
            }

            alert(
                details.join("\n")
            );
        };

    const initFirebase = () => {
        if (!window.firebase) {
            throw new Error(
                "Firebase SDK is not loaded."
            );
        }

        if (!firebase.apps.length) {
            throw new Error(
                "Firebase configuration has not been initialized."
            );
        }

        db =
            firebase.firestore();
    };

    const loadData = async () => {
        const config =
            window.CONFIG || {};

        const bookingsCollection =
            config.firestore?.bookingsCollection ||
            window.APP_CONFIG?.firestore?.bookingsCollection ||
            "bookings";

        const paymentsCollection =
            config.firestore?.paymentsCollection ||
            window.APP_CONFIG?.firestore?.paymentsCollection ||
            "payments";

        const [
            bookingSnapshot,
            paymentSnapshot
        ] = await Promise.all([
            db
                .collection(
                    bookingsCollection
                )
                .get(),

            db
                .collection(
                    paymentsCollection
                )
                .get()
        ]);

        bookingMap =
            new Map();

        allBookings = [];

        bookingSnapshot.forEach(doc => {
            const booking = {
                id: doc.id,
                ...doc.data()
            };

            allBookings.push(
                booking
            );

            bookingMap.set(
                doc.id,
                booking
            );
        });

        allPayments = [];

        paymentSnapshot.forEach(doc => {
            allPayments.push({
                id: doc.id,
                ...doc.data()
            });
        });

        allPayments.sort(
            (a, b) =>
                String(
                    b.paymentDate || ""
                ).localeCompare(
                    String(
                        a.paymentDate || ""
                    )
                )
        );
    };

    const refresh = async () => {
        const loading =
            document.getElementById(
                "loadingState"
            );

        const error =
            document.getElementById(
                "errorState"
            );

        const content =
            document.getElementById(
                "paymentsContent"
            );

        try {
            loading.hidden = false;
            error.hidden = true;
            content.hidden = true;

            await loadData();

            const filteredPayments =
                applyFilters();

            renderSummary(
                filteredPayments
            );

            renderRows(
                filteredPayments
            );

            document.getElementById(
                "resultCount"
            ).textContent =
                `${filteredPayments.length} payment(s)`;

            renderBookingOptions();
            updateRecordBookingContext();
            updateRecordProjection();

            content.hidden = false;

        } catch (err) {
            console.error(
                "Accounts Payments load failed:",
                err
            );

            error.textContent =
                `Unable to load payment data: ${
                    err.message || err
                }`;

            error.hidden = false;

        } finally {
            loading.hidden = true;
        }
    };

    const resetFilters = () => {
        document.getElementById(
            "dateFrom"
        ).value = "";

        document.getElementById(
            "dateTo"
        ).value = "";

        document.getElementById(
            "paymentType"
        ).value = "";

        document.getElementById(
            "paymentStatus"
        ).value = "";

        document.getElementById(
            "paymentMethod"
        ).value = "";

        document.getElementById(
            "searchText"
        ).value = "";

        refresh();
    };

    const applyCurrentFilters = () => {
        const filteredPayments =
            applyFilters();

        renderSummary(
            filteredPayments
        );

        renderRows(
            filteredPayments
        );

        document.getElementById(
            "resultCount"
        ).textContent =
            `${filteredPayments.length} payment(s)`;
    };

    const initEvents = () => {

        document
            .getElementById(
                "refreshButton"
            )
            .addEventListener(
                "click",
                refresh
            );

        document
            .getElementById(
                "clearButton"
            )
            .addEventListener(
                "click",
                resetFilters
            );

        document
            .getElementById(
                "applyButton"
            )
            .addEventListener(
                "click",
                applyCurrentFilters
            );

        document
            .getElementById(
                "paymentsBody"
            )
            .addEventListener(
                "click",
                event => {
                    const button =
                        event.target.closest(
                            "[data-payment-id]"
                        );

                    if (!button) {
                        return;
                    }

                    showPaymentDetails(
                        button.dataset
                            .paymentId
                    );
                }
            );

        document
            .getElementById(
                "recordPaymentButton"
            )
            .addEventListener(
                "click",
                openRecordPayment
            );

        document
            .getElementById(
                "cancelRecordPaymentButton"
            )
            .addEventListener(
                "click",
                closeRecordPayment
            );

        const recordPaymentForm =
            document.getElementById(
                "recordPaymentForm"
            );

        recordPaymentForm.addEventListener(
            "submit",
            savePayment
        );

        // Clear any previous success/error message when
        // native HTML validation rejects a field.
        recordPaymentForm.addEventListener(
            "invalid",
            () => {
                setRecordMessage("", "");
            },
            true
        );

        document
            .getElementById(
                "recordBookingId"
            )
            .addEventListener(
                "change",
                () => {
                    const booking =
                        getRecordBooking();

                    if (booking) {
                        document.getElementById(
                            "recordCurrency"
                        ).value =
                            text(
                                booking.currency
                            ) || "AUD";
                    }

                    updateRecordBookingContext();
                    updateRecordProjection();
                }
            );

        document
            .getElementById(
                "recordPaymentType"
            )
            .addEventListener(
                "change",
                () => {
                    updateRefundHelp();
                    updateRecordProjection();
                }
            );

        document
            .getElementById(
                "recordPaymentStatus"
            )
            .addEventListener(
                "change",
                updateRecordProjection
            );

        document
            .getElementById(
                "recordAmount"
            )
            .addEventListener(
                "input",
                updateRecordProjection
            );
    };

    document.addEventListener(
        "DOMContentLoaded",
        async () => {
            try {
                initFirebase();
                initEvents();

                document.getElementById(
                    "recordPaymentDate"
                ).value =
                    todayLocal();

                await refresh();

            } catch (error) {
                console.error(
                    "Accounts Payments initialisation failed:",
                    error
                );

                document.getElementById(
                    "loadingState"
                ).hidden = true;

                const errorState =
                    document.getElementById(
                        "errorState"
                    );

                errorState.textContent =
                    `Unable to initialise Payments: ${
                        error.message || error
                    }`;

                errorState.hidden = false;
            }
        }
    );
})();
