(function () {
    "use strict";

    let db = null;
    let allBookings = [];

    const money = (value, currency = "AUD") => {
        const amount = Number(value) || 0;
        return `${currency} ${amount.toFixed(2)}`;
    };

    const number = (value) => Number(value) || 0;

    const DEFAULT_EXCHANGE_RATES_TO_LKR = Object.freeze({
        AUD: 225,
        USD: 330
    });

    function calculateOverallPaymentStatus(totalLkr, depositPaidLkr, balancePaidLkr) {
        const total = Number(totalLkr);
        const depositPaid = Number(depositPaidLkr);
        const balancePaid = Number(balancePaidLkr);

        const validTotal = Number.isFinite(total) && total > 0 ? total : 0;
        const validDepositPaid =
            Number.isFinite(depositPaid) && depositPaid > 0 ? depositPaid : 0;
        const validBalancePaid =
            Number.isFinite(balancePaid) && balancePaid > 0 ? balancePaid : 0;
        const totalReceived = validDepositPaid + validBalancePaid;

        // Allow one cent for currency rounding and floating-point residue.
        if (validTotal > 0 && totalReceived >= validTotal - 0.01) {
            return "Paid";
        }

        if (validBalancePaid > 0) {
            return "Balance Due";
        }

        if (validDepositPaid > 0) {
            return "Deposit Paid";
        }

        return "Deposit Required";
    }

    const hasActualPaymentAmounts = (booking, paymentPrefix) => {
        return (
            Object.prototype.hasOwnProperty.call(
                booking,
                `${paymentPrefix}PaymentAmount`
            ) ||
            Object.prototype.hasOwnProperty.call(
                booking,
                `${paymentPrefix}PaymentAmountLkr`
            )
        );
    };

    const getActualPaymentAmountLkr = (booking, paymentPrefix) => {
        if (!hasActualPaymentAmounts(booking, paymentPrefix)) {
            return null;
        }

        if (booking[`${paymentPrefix}PaymentStatus`] !== "Paid") {
            return 0;
        }

        const storedAmountLkr = parseFiniteNonNegativeNumber(
            booking[`${paymentPrefix}PaymentAmountLkr`]
        );
        if (storedAmountLkr !== null) {
            return storedAmountLkr;
        }

        const amount = parseFiniteNonNegativeNumber(
            booking[`${paymentPrefix}PaymentAmount`]
        );
        if (amount === null) {
            return 0;
        }

        const paymentCurrency = String(
            booking[`${paymentPrefix}PaymentCurrency`] ||
                booking.currency ||
                ""
        ).toUpperCase();

        if (paymentCurrency === "LKR") {
            return amount;
        }

        const paymentRate = parseFiniteNonNegativeNumber(
            booking[`${paymentPrefix}PaymentExchangeRateToLkr`]
        );
        const bookingCurrency = String(
            booking.currency || "AUD"
        ).toUpperCase();
        const exchangeRate = paymentRate !== null && paymentRate > 0
            ? paymentRate
            : paymentCurrency === bookingCurrency
                ? parseFiniteNonNegativeNumber(booking.exchangeRateToLkr)
                : null;

        if (exchangeRate === null || exchangeRate <= 0) {
            return 0;
        }

        return calculateLkrEquivalent(amount, exchangeRate) || 0;
    };


    const parseFiniteNonNegativeNumber = (value) => {
        if (typeof value !== "number" && typeof value !== "string") {
            return null;
        }

        if (typeof value === "string" && value.trim() === "") {
            return null;
        }

        const parsed = Number(value);

        return Number.isFinite(parsed) && parsed >= 0
            ? parsed
            : null;
    };

    const calculateLkrEquivalent = (amount, exchangeRate) => {
        const validAmount = parseFiniteNonNegativeNumber(amount);
        const validRate = parseFiniteNonNegativeNumber(exchangeRate);

        if (validAmount === null || validRate === null) {
            return null;
        }

        const amountLkr = validAmount * validRate;

        return Number.isFinite(amountLkr) && amountLkr >= 0
            ? amountLkr
            : null;
    };

    const isPositiveFiniteNumber = (value) =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0;

    const getGuestCount = (booking) => {
        const storedTotal = Number(booking.totalGuests);

        if (Number.isFinite(storedTotal) && storedTotal > 0) {
            return storedTotal;
        }

        const adults = Number(booking.adults) || 0;
        const children = Number(booking.children) || 0;

        return adults + children;
    };

    const getBookingReference = (booking, id) => {
        return booking.bookingReference || id.substring(0, 8);
    };

    const getPaymentStatus = (booking) => {
        const hasActualPaymentData =
            hasActualPaymentAmounts(booking, "deposit") ||
            hasActualPaymentAmounts(booking, "balance");

        if (hasActualPaymentData) {
            const totalLkr = getTotalLkr(booking);
            const depositPaidLkr = getDepositPaidLkr(booking);
            const balancePaidLkr = getBalancePaidLkr(booking);
            const outstandingLkr =
                totalLkr - depositPaidLkr - balancePaidLkr;

            if (
                booking.balancePaymentStatus === "Balance Due" &&
                outstandingLkr > 0.01
            ) {
                return "Balance Due";
            }

            return calculateOverallPaymentStatus(
                totalLkr,
                depositPaidLkr,
                balancePaidLkr
            );
        }

        // Preserve the established status for legacy records without actual payment amounts.
        const hasBalanceStatus =
            booking.balancePaymentStatus !== undefined &&
            booking.balancePaymentStatus !== null;

        const hasBalanceFlag =
            typeof booking.balancePaid === "boolean";

        const hasSeparatePaymentFields =
            (booking.depositPaymentStatus !== undefined &&
                booking.depositPaymentStatus !== null) ||
            hasBalanceStatus ||
            typeof booking.depositPaid === "boolean" ||
            hasBalanceFlag;

        if (!hasSeparatePaymentFields) {
            return booking.paymentStatus || "Pending";
        }

        const depositPaid =
            booking.depositPaymentStatus === "Paid" ||
            booking.depositPaid === true;

        const balancePaid =
            booking.balancePaymentStatus === "Paid" ||
            booking.balancePaid === true;

        if (depositPaid && balancePaid) {
            return "Paid";
        }

        if (depositPaid) {
            return "Deposit Paid";
        }

        if (balancePaid) {
            return "Balance Due";
        }

        return "Deposit Required";
    };

    const getDepositPaid = (booking) => {
        if (hasActualPaymentAmounts(booking, "deposit")) {
            if (booking.depositPaymentStatus !== "Paid") {
                return 0;
            }

            return parseFiniteNonNegativeNumber(
                booking.depositPaymentAmount
            ) || 0;
        }

        if (
            booking.depositPaymentStatus === "Paid" &&
            number(booking.depositPaymentAmount) > 0
        ) {
            return number(booking.depositPaymentAmount);
        }

        if (
            booking.depositPaid === true ||
            (
                (booking.depositPaymentStatus === undefined ||
                    booking.depositPaymentStatus === null) &&
                booking.paymentStatus === "Balance Due"
            )
        ) {
            return number(booking.depositAmount);
        }

        return 0;
    };

    const getBalancePaid = (booking) => {
        if (hasActualPaymentAmounts(booking, "balance")) {
            if (booking.balancePaymentStatus !== "Paid") {
                return 0;
            }

            return parseFiniteNonNegativeNumber(
                booking.balancePaymentAmount
            ) || 0;
        }

        if (
            booking.balancePaymentStatus === "Paid" &&
            number(booking.balancePaymentAmount) > 0
        ) {
            return number(booking.balancePaymentAmount);
        }

        if (booking.balancePaid === true) {
            return number(booking.balanceAmount);
        }

        return 0;
    };

    const getOutstanding = (booking) => {
        const currency = booking.currency || "AUD";

        if (currency === "LKR") {
            return getOutstandingLkr(booking);
        }

        const exchangeRate = parseFiniteNonNegativeNumber(
            booking.exchangeRateToLkr
        );

        if (exchangeRate !== null && exchangeRate > 0) {
            return getOutstandingLkr(booking) / exchangeRate;
        }

        // Legacy fallback when no LKR exchange rate was stored.
        const total = number(booking.total);
        const depositPaid = getDepositPaid(booking);
        const balancePaid = getBalancePaid(booking);

        return Math.max(
            0,
            total - depositPaid - balancePaid
        );
    };
    const getDepositPaidLkr = (booking) => {
        const actualPayment = getActualPaymentAmountLkr(
            booking,
            "deposit"
        );
        if (actualPayment !== null) {
            return actualPayment;
        }

        if (
            booking.depositPaid === true ||
            (
                (booking.depositPaymentStatus === undefined ||
                    booking.depositPaymentStatus === null) &&
                booking.paymentStatus === "Balance Due"
            )
        ) {
            return parseFiniteNonNegativeNumber(booking.depositAmountLkr) || 0;
        }

        return 0;
    };

    const getBalancePaidLkr = (booking) => {
        const actualPayment = getActualPaymentAmountLkr(
            booking,
            "balance"
        );
        if (actualPayment !== null) {
            return actualPayment;
        }

        if (booking.balancePaid === true) {
            return parseFiniteNonNegativeNumber(booking.balanceAmountLkr) || 0;
        }

        return 0;
    };

    const getTotalLkr = (booking) => {
        const storedTotalLkr = parseFiniteNonNegativeNumber(booking.totalLkr);
        if (storedTotalLkr !== null && storedTotalLkr > 0) {
            return storedTotalLkr;
        }

        const total = parseFiniteNonNegativeNumber(booking.total) || 0;

        if (booking.currency === "LKR") {
            return total;
        }

        const exchangeRate = parseFiniteNonNegativeNumber(
            booking.exchangeRateToLkr
        );
        if (exchangeRate === null || exchangeRate <= 0) {
            return 0;
        }

        return calculateLkrEquivalent(total, exchangeRate) || 0;
    };

    const getOutstandingLkr = (booking) => {
        const totalLkr = getTotalLkr(booking);
        const depositPaidLkr = getDepositPaidLkr(booking);
        const balancePaidLkr = getBalancePaidLkr(booking);

        const outstandingLkr = totalLkr - depositPaidLkr - balancePaidLkr;

        return Number.isFinite(outstandingLkr)
            ? Math.max(0, outstandingLkr)
            : 0;
    };

    const parseDate = (value) => {
        if (!value) return null;

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

    const startOfDay = (date) => {
        return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );
    };

    const dateInRange = (booking, from, to) => {
        const checkin = parseDate(booking.checkin);
        const checkout = parseDate(booking.checkout);

        if (!from && !to) {
            return true;
        }

        if (!checkin) {
            return false;
        }

        if (from && checkout && checkout <= from) {
            return false;
        }

        if (to && checkin > to) {
            return false;
        }

        if (from && !checkout && checkin < from) {
            return false;
        }

        return true;
    };

    const statusClass = (status) => {
        return String(status || "Pending")
            .toLowerCase()
            .replace(/\s+/g, "-");
    };

    const paymentClass = (status) => {
        if (status === "Paid") return "payment-paid";
        if (status === "Deposit Paid") return "payment-deposit";
        if (
            status === "Deposit Required" ||
            status === "Balance Due"
        ) {
            return "payment-due";
        }

        return "payment-other";
    };

    const initFirebase = () => {
        if (!window.firebase) {
            throw new Error("Firebase SDK is not loaded.");
        }

        if (!firebase.apps.length) {
            throw new Error(
                "Firebase configuration has not been initialized."
            );
        }

        db = firebase.firestore();
    };

    const loadBookings = async () => {
        const config = window.CONFIG || {};
        const collectionName =
            config.firestore?.bookingsCollection ||
            window.APP_CONFIG?.firestore?.bookingsCollection ||
            "bookings";

        const snapshot = await db
            .collection(collectionName)
            .get();

        allBookings = [];

        snapshot.forEach((doc) => {
            allBookings.push({
                id: doc.id,
                ...doc.data()
            });
        });

        allBookings.sort((a, b) => {
            return String(
                b.checkin || ""
            ).localeCompare(
                String(a.checkin || "")
            );
        });
    };

    const getFilters = () => {
        const fromValue =
            document.getElementById("dateFrom").value;

        const toValue =
            document.getElementById("dateTo").value;

        let from = null;
        let to = null;

        if (fromValue) {
            from = startOfDay(
                parseDate(fromValue)
            );
        }

        if (toValue) {
            to = new Date(
                parseDate(toValue).getFullYear(),
                parseDate(toValue).getMonth(),
                parseDate(toValue).getDate(),
                23,
                59,
                59,
                999
            );
        }

        return {
            from,
            to,
            bookingStatus:
                document.getElementById("bookingStatus").value,
            paymentStatus:
                document.getElementById("paymentStatus").value,
            search:
                document.getElementById("searchText").value
                    .trim()
                    .toLowerCase()
        };
    };

    const applyFilters = () => {
        const filters = getFilters();

        return allBookings.filter((booking) => {

            if (
                filters.bookingStatus &&
                booking.status !== filters.bookingStatus
            ) {
                return false;
            }

            const paymentStatus =
                getPaymentStatus(booking);

            if (
                filters.paymentStatus &&
                paymentStatus !== filters.paymentStatus
            ) {
                return false;
            }

            if (
                !dateInRange(
                    booking,
                    filters.from,
                    filters.to
                )
            ) {
                return false;
            }

            if (filters.search) {
                const reference =
                    getBookingReference(
                        booking,
                        booking.id
                    ).toLowerCase();

                const guest =
                    String(
                        booking.guestName || ""
                    ).toLowerCase();

                const email =
                    String(
                        booking.email || ""
                    ).toLowerCase();

                if (
                    !reference.includes(filters.search) &&
                    !guest.includes(filters.search) &&
                    !email.includes(filters.search)
                ) {
                    return false;
                }
            }

            return true;
        });
    };

    const renderSummary = (bookings) => {
        const totalBookings =
            bookings.length;

        const confirmedBookings =
            bookings.filter(
                booking => booking.status === "Confirmed"
            ).length;

        const revenue =
            bookings
                .filter(
                    booking =>
                        booking.status === "Confirmed"
                )
                .reduce(
                    (sum, booking) =>
                        sum + getTotalLkr(booking),
                    0
                );

        const deposits =
            bookings.reduce(
                (sum, booking) =>
                    sum + getDepositPaidLkr(booking),
                0
            );

        const balances =
            bookings.reduce(
                (sum, booking) =>
                    sum + getBalancePaidLkr(booking),
                0
            );

        const outstanding =
            bookings.reduce(
                (sum, booking) =>
                    sum + getOutstandingLkr(booking),
                0
            );

        document.getElementById(
            "summaryTotalBookings"
        ).textContent = totalBookings;

        document.getElementById(
            "summaryConfirmed"
        ).textContent = confirmedBookings;

        document.getElementById(
            "summaryRevenue"
        ).textContent = money(revenue, "LKR");

        document.getElementById(
            "summaryDeposits"
        ).textContent = money(deposits, "LKR");

        document.getElementById(
            "summaryBalances"
        ).textContent = money(balances, "LKR");

        document.getElementById(
            "summaryOutstanding"
        ).textContent = money(outstanding, "LKR");
    };

    const showEditBooking = (booking) => {
        const bookingCurrency = booking.currency || "AUD";

        document.getElementById("editBookingReference").textContent =
            getBookingReference(booking, booking.id);

        document.getElementById("editBookingGuest").textContent =
            booking.guestName ||
            booking.guest ||
            booking.name ||
            "-";

        document.getElementById("editBookingStatus").value =
            booking.status || "Confirmed";

        const legacyPaymentStatus =
            getPaymentStatus(booking);

        const depositPaymentStatus =
            booking.depositPaymentStatus ||
            (booking.depositPaid === true ||
            legacyPaymentStatus === "Deposit Paid" ||
            legacyPaymentStatus === "Balance Due" ||
            legacyPaymentStatus === "Paid"
                ? "Paid"
                : "Not Paid");

        const storedBalancePaymentStatus =
            booking.balancePaymentStatus;

        const balancePaymentStatus =
            storedBalancePaymentStatus === "Paid" ||
            storedBalancePaymentStatus === "Not Paid"
                ? storedBalancePaymentStatus
                : (
                    booking.balancePaid === true ||
                    legacyPaymentStatus === "Paid"
                        ? "Paid"
                        : "Not Paid"
                );

        document.getElementById("editDepositPaymentStatus").value =
            depositPaymentStatus;

        const depositPaymentCurrency =
            booking.depositPaymentCurrency ||
            (depositPaymentStatus === "Paid"
                ? booking.paymentCurrency || bookingCurrency
                : "");

        document.getElementById("editDepositPaymentCurrency").value =
            depositPaymentCurrency;

        document.getElementById("editDepositPaymentAmount").value =
            booking.depositPaymentAmount ??
            (
                depositPaymentStatus === "Paid" &&
                !booking.depositPaymentStatus
                    ? booking.depositAmount ?? ""
                    : ""
            );

        document.getElementById("editDepositPaymentDate").value =
            booking.depositPaymentDate ||
            (depositPaymentStatus === "Paid"
                ? booking.paymentReceivedDate || ""
                : "");

        document.getElementById("editDepositPaymentExchangeRate").value =
            booking.depositPaymentExchangeRateToLkr ??
            (
                depositPaymentStatus === "Paid" &&
                !booking.depositPaymentStatus &&
                depositPaymentCurrency === bookingCurrency
                    ? booking.exchangeRateToLkr ?? ""
                    : depositPaymentCurrency === "LKR"
                        ? 1
                        : ""
            );

        document.getElementById("editBalancePaymentStatus").value =
            balancePaymentStatus;

        const balancePaymentCurrency =
            booking.balancePaymentCurrency ||
            (balancePaymentStatus === "Paid"
                ? booking.paymentCurrency || bookingCurrency
                : "");

        document.getElementById("editBalancePaymentCurrency").value =
            balancePaymentCurrency;

        document.getElementById("editBalancePaymentAmount").value =
            booking.balancePaymentAmount ??
            (
                balancePaymentStatus === "Paid" &&
                !booking.balancePaymentStatus
                    ? booking.balanceAmount ?? ""
                    : ""
            );

        document.getElementById("editBalancePaymentDate").value =
            booking.balancePaymentDate ||
            (balancePaymentStatus === "Paid"
                ? booking.paymentReceivedDate || ""
                : "");

        document.getElementById("editBalancePaymentExchangeRate").value =
            booking.balancePaymentExchangeRateToLkr ??
            (
                balancePaymentStatus === "Paid" &&
                !booking.balancePaymentStatus &&
                balancePaymentCurrency === bookingCurrency
                    ? booking.exchangeRateToLkr ?? ""
                    : balancePaymentCurrency === "LKR"
                        ? 1
                        : ""
            );

        [
            "editDepositPaymentStatus",
            "editDepositPaymentCurrency",
            "editDepositPaymentAmount",
            "editDepositPaymentDate",
            "editDepositPaymentExchangeRate",
            "editBalancePaymentStatus",
            "editBalancePaymentCurrency",
            "editBalancePaymentAmount",
            "editBalancePaymentDate",
            "editBalancePaymentExchangeRate"
        ].forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                element.dataset.originalValue = element.value;
            }
        });

        document.getElementById("editBookingError").style.display = "none";

        const editCard =
            document.getElementById("editBookingCard");

        editCard.style.display = "block";

        editCard.dataset.bookingId = booking.id;

        calculateEditPaymentAmounts();

        editCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    };

    const hideEditBooking = () => {
        const editCard =
            document.getElementById("editBookingCard");

        if (editCard) {
            editCard.style.display = "none";
            editCard.dataset.bookingId = "";
        }
    };

    const saveEditBooking = async () => {
        const editCard =
            document.getElementById("editBookingCard");

        const errorElement =
            document.getElementById("editBookingError");

        const bookingId =
            editCard?.dataset.bookingId;

        if (!bookingId) {
            return;
        }

        const bookingStatus =
            document.getElementById("editBookingStatus").value;

        const originalBooking = allBookings.find(
            (booking) => booking.id === bookingId
        );

        if (!originalBooking) {
            errorElement.textContent =
                "Original booking not found. Please reload and try again.";
            errorElement.style.display = "block";
            return;
        }

        const paymentFieldIds = [
            "editDepositPaymentStatus",
            "editDepositPaymentCurrency",
            "editDepositPaymentAmount",
            "editDepositPaymentDate",
            "editDepositPaymentExchangeRate",
            "editBalancePaymentStatus",
            "editBalancePaymentCurrency",
            "editBalancePaymentAmount",
            "editBalancePaymentDate",
            "editBalancePaymentExchangeRate"
        ];

        const paymentFieldsChanged = paymentFieldIds.some((id) => {
            const element = document.getElementById(id);
            return !element ||
                element.value !== element.dataset.originalValue;
        });

        if (!paymentFieldsChanged) {
            try {
                errorElement.style.display = "none";

                const config = window.CONFIG || {};
                const collectionName =
                    config.firestore?.bookingsCollection ||
                    window.APP_CONFIG?.firestore?.bookingsCollection ||
                    "bookings";

                await db.collection(collectionName)
                    .doc(bookingId)
                    .update({
                        status: bookingStatus
                    });

                await loadBookings();
                hideEditBooking();
                refresh();

                const updatedBooking = allBookings.find(
                    (booking) => booking.id === bookingId
                );

                if (updatedBooking) {
                    showDetail(updatedBooking);
                }

                return;
            } catch (error) {
                console.error("Booking status update error:", error);
                errorElement.textContent =
                    error.message || "Unable to update booking.";
                errorElement.style.display = "block";
                return;
            }
        }

        const depositPaymentStatus =
            document.getElementById("editDepositPaymentStatus").value;

        const depositPaymentCurrency =
            document.getElementById("editDepositPaymentCurrency").value;

        const depositPaymentAmount =
            Number(
                document.getElementById("editDepositPaymentAmount").value
            ) || 0;

        const depositPaymentDate =
            document.getElementById("editDepositPaymentDate").value;

        const depositPaymentExchangeRateToLkr =
            depositPaymentCurrency === "LKR"
                ? 1
                : Number(
                    document.getElementById(
                        "editDepositPaymentExchangeRate"
                    ).value
                ) || 0;

        const depositPaymentAmountLkr = calculateLkrEquivalent(
            depositPaymentAmount,
            depositPaymentExchangeRateToLkr
        );

        const balancePaymentStatus =
            document.getElementById("editBalancePaymentStatus").value;

        const balancePaymentCurrency =
            document.getElementById("editBalancePaymentCurrency").value;

        const balancePaymentAmount =
            Number(
                document.getElementById("editBalancePaymentAmount").value
            ) || 0;

        const balancePaymentDate =
            document.getElementById("editBalancePaymentDate").value;

        const balancePaymentExchangeRateToLkr =
            balancePaymentCurrency === "LKR"
                ? 1
                : Number(
                    document.getElementById(
                        "editBalancePaymentExchangeRate"
                    ).value
                ) || 0;

        const balancePaymentAmountLkr = calculateLkrEquivalent(
            balancePaymentAmount,
            balancePaymentExchangeRateToLkr
        );

        const validateActualPayment = (
            paymentName,
            status,
            currency,
            amount,
            paymentDate,
            exchangeRate,
            amountLkr
        ) => {
            if (amountLkr === null) {
                errorElement.textContent =
                    `${paymentName} LKR equivalent must be a finite, non-negative amount.`;
                errorElement.style.display = "block";
                return false;
            }

            if (status !== "Paid") {
                return true;
            }

            if (!Number.isFinite(amountLkr) || amountLkr <= 0) {
                errorElement.textContent =
                    `${paymentName} LKR equivalent must be greater than zero.`;
                errorElement.style.display = "block";
                return false;
            }

            if (!currency) {
                errorElement.textContent =
                    `${paymentName} currency is required when the payment status is Paid.`;
                errorElement.style.display = "block";
                return false;
            }

            if (!Number.isFinite(amount) || amount <= 0) {
                errorElement.textContent =
                    `${paymentName} amount must be greater than zero.`;
                errorElement.style.display = "block";
                return false;
            }

            if (!paymentDate) {
                errorElement.textContent =
                    `${paymentName} date is required.`;
                errorElement.style.display = "block";
                return false;
            }

            if (
                currency !== "LKR" &&
                !isPositiveFiniteNumber(exchangeRate)
            ) {
                errorElement.textContent =
                    `${paymentName} exchange rate to LKR is required for ${currency} payments.`;
                errorElement.style.display = "block";
                return false;
            }

            return true;
        };

        if (
            !validateActualPayment(
                "Deposit payment",
                depositPaymentStatus,
                depositPaymentCurrency,
                depositPaymentAmount,
                depositPaymentDate,
                depositPaymentExchangeRateToLkr,
                depositPaymentAmountLkr
            ) ||
            !validateActualPayment(
                "Balance payment",
                balancePaymentStatus,
                balancePaymentCurrency,
                balancePaymentAmount,
                balancePaymentDate,
                balancePaymentExchangeRateToLkr,
                balancePaymentAmountLkr
            )
        ) {
            errorElement.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            return;
        }

        const depositPaid =
            depositPaymentStatus === "Paid";

        const balancePaid =
            balancePaymentStatus === "Paid";

        const paymentStatus = calculateOverallPaymentStatus(
            getTotalLkr(originalBooking),
            depositPaid ? depositPaymentAmountLkr : 0,
            balancePaid ? balancePaymentAmountLkr : 0
        );

        const paymentCurrency =
            balancePaid
                ? balancePaymentCurrency
                : depositPaid
                    ? depositPaymentCurrency
                    : "";

        const paymentReceivedDate =
            balancePaid
                ? balancePaymentDate
                : depositPaid
                    ? depositPaymentDate
                    : "";

        try {
            errorElement.style.display = "none";

            const config = window.CONFIG || {};

            const collectionName =
                config.firestore?.bookingsCollection ||
                window.APP_CONFIG?.firestore?.bookingsCollection ||
                "bookings";

            await db
                .collection(collectionName)
                .doc(bookingId)
                .update({
                    status: bookingStatus,

                    paymentStatus: paymentStatus,
                    paymentCurrency: paymentCurrency,
                    paymentReceivedDate: paymentReceivedDate,

                    depositPaid: depositPaid,
                    balancePaid: balancePaid,

                    depositPaymentStatus:
                        depositPaymentStatus,
                    depositPaymentAmount:
                        depositPaymentAmount,
                    depositPaymentCurrency:
                        depositPaymentCurrency,
                    depositPaymentDate:
                        depositPaymentDate,
                    depositPaymentExchangeRateToLkr:
                        depositPaymentExchangeRateToLkr,
                    depositPaymentAmountLkr:
                        depositPaymentAmountLkr,

                    balancePaymentStatus:
                        balancePaymentStatus,
                    balancePaymentAmount:
                        balancePaymentAmount,
                    balancePaymentCurrency:
                        balancePaymentCurrency,
                    balancePaymentDate:
                        balancePaymentDate,
                    balancePaymentExchangeRateToLkr:
                        balancePaymentExchangeRateToLkr,
                    balancePaymentAmountLkr:
                        balancePaymentAmountLkr
                });

            await loadBookings();

            hideEditBooking();

            refresh();

            const updatedBooking =
                allBookings.find(
                    (booking) => booking.id === bookingId
                );

            if (updatedBooking) {
                showDetail(updatedBooking);
            }

        } catch (error) {
            console.error(
                "Edit booking save error:",
                error
            );

            errorElement.textContent =
                error.message ||
                "Unable to save booking changes.";

            errorElement.style.display = "block";
        }
    };
    const renderRows = (bookings) => {
        const tbody =
            document.getElementById(
                "bookingTableBody"
            );

        tbody.innerHTML = "";

        document.getElementById(
            "emptyMessage"
        ).style.display =
            bookings.length ? "none" : "block";

        bookings.forEach((booking) => {

            const paymentStatus =
                getPaymentStatus(booking);

            const deposit =
                number(booking.depositAmount);

            const balance =
                number(booking.balanceAmount);

            const outstanding =
                getOutstanding(booking);

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td>
                    <strong>
                        ${escapeHtml(
                            getBookingReference(
                                booking,
                                booking.id
                            )
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        booking.guestName || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        booking.checkin || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        booking.checkout || "-"
                    )}
                </td>

                <td class="numeric">
                    ${getGuestCount(booking)}
                </td>

                <td>
                    <span class="status status-${statusClass(booking.status)}">
                        ${escapeHtml(
                            booking.status || "Pending"
                        )}
                    </span>
                </td>

                <td>
                    <span class="status ${paymentClass(paymentStatus)}">
                        ${escapeHtml(paymentStatus)}
                    </span>
                </td>

                <td class="numeric">
                    ${money(booking.total, booking.currency || "AUD")}
                </td>

                <td class="numeric">
                    ${money(deposit, booking.currency || "AUD")}
                </td>

                <td class="numeric">
                    ${money(balance, booking.currency || "AUD")}
                </td>

                <td class="numeric">
                    ${money(outstanding, booking.currency || "AUD")}
                </td>

                <td>
                    <button
                        type="button"
                        class="btn-secondary view-booking-btn"
                        data-booking-id="${escapeHtml(booking.id)}">
                        View
                    </button>

                    <button
                        type="button"
                        class="btn-secondary edit-booking-btn"
                        data-booking-id="${escapeHtml(booking.id)}">
                        Edit
                    </button>
                </td>
            `;

            row.querySelector(".view-booking-btn")
                .addEventListener(
                    "click",
                    () => showDetail(booking)
                );

            row.querySelector(".edit-booking-btn")
                .addEventListener(
                    "click",
                    () => showEditBooking(booking)
                );

            tbody.appendChild(row);
        });
    };

    const showDetail = (booking) => {
        const paymentStatus =
            getPaymentStatus(booking);

        document.getElementById(
            "detailReference"
        ).textContent =
            getBookingReference(
                booking,
                booking.id
            );

        document.getElementById(
            "detailGuest"
        ).textContent =
            booking.guestName || "-";

        document.getElementById(
            "detailCheckin"
        ).textContent =
            booking.checkin || "-";

        document.getElementById(
            "detailCheckout"
        ).textContent =
            booking.checkout || "-";

        document.getElementById(
            "detailNights"
        ).textContent =
            number(booking.nights);

        document.getElementById(
            "detailAdults"
        ).textContent =
            number(booking.adults);

        document.getElementById(
            "detailChildren"
        ).textContent =
            number(booking.children);

        document.getElementById(
            "detailGuests"
        ).textContent =
            getGuestCount(booking);

        document.getElementById(
            "detailAccommodation"
        ).textContent =
            money(booking.accommodation, booking.currency || "AUD");

        document.getElementById(
            "detailExtraGuest"
        ).textContent =
            money(booking.extraGuestFee, booking.currency || "AUD");

        document.getElementById(
            "detailCleaning"
        ).textContent =
            money(booking.cleaningFee, booking.currency || "AUD");

        document.getElementById(
            "detailTotal"
        ).textContent =
            money(booking.total, booking.currency || "AUD");

        document.getElementById(
            "detailDeposit"
        ).textContent =
            money(booking.depositAmount, booking.currency || "AUD");

        document.getElementById(
            "detailDepositPaid"
        ).textContent =
            `${(booking.depositPaymentCurrency === "LKR") ? money(getDepositPaidLkr(booking), "LKR") : `${money(getDepositPaid(booking), booking.depositPaymentCurrency || booking.currency || "AUD")} | ${money(getDepositPaidLkr(booking), "LKR")}`}`;

        document.getElementById(
            "detailBalance"
        ).textContent =
            money(booking.balanceAmount, booking.currency || "AUD");

        document.getElementById(
            "detailBalancePaid"
        ).textContent =
            `${(booking.balancePaymentCurrency === "LKR") ? money(getBalancePaidLkr(booking), "LKR") : `${money(getBalancePaid(booking), booking.balancePaymentCurrency || booking.currency || "AUD")} | ${money(getBalancePaidLkr(booking), "LKR")}`}`;

        document.getElementById(
            "detailOutstanding"
        ).textContent =
            money(getOutstandingLkr(booking), "LKR");

        document.getElementById(
            "detailPaymentStatus"
        ).textContent =
            paymentStatus;

        document.getElementById(
            "detailBookingStatus"
        ).textContent =
            booking.status || "Pending";

        document.getElementById(
            "detailCard"
        ).style.display = "block";

        document.getElementById(
            "detailCard"
        ).scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    };

    const refresh = () => {
        const filtered =
            applyFilters();

        renderSummary(filtered);
        renderRows(filtered);

        document.getElementById(
            "periodNote"
        ).textContent =
            `${filtered.length} booking(s) match the current filters.`;
    };

    const clearFilters = () => {
        document.getElementById(
            "dateFrom"
        ).value = "";

        document.getElementById(
            "dateTo"
        ).value = "";

        document.getElementById(
            "bookingStatus"
        ).value = "";

        document.getElementById(
            "paymentStatus"
        ).value = "";

        document.getElementById(
            "searchText"
        ).value = "";

        document.getElementById(
            "detailCard"
        ).style.display = "none";

        refresh();
    };

    const escapeHtml = (value) => {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const showError = (message) => {
        const error =
            document.getElementById(
                "errorMessage"
            );

        error.textContent = message;
        error.style.display = "block";
    };

    const clearError = () => {
        document.getElementById(
            "errorMessage"
        ).style.display = "none";
    };

    const init = async () => {
        try {
            clearError();

            initFirebase();

            await loadBookings();

            document.getElementById(
                "loadingMessage"
            ).style.display = "none";

            refresh();

            document.getElementById(
                "refreshBtn"
            ).addEventListener(
                "click",
                refresh
            );

            document.getElementById(
                "clearBtn"
            ).addEventListener(
                "click",
                clearFilters
            );

            [
                "bookingStatus",
                "paymentStatus",
                "dateFrom",
                "dateTo"
            ].forEach((id) => {
                document.getElementById(id)
                    .addEventListener(
                        "change",
                        refresh
                    );
            });

            document.getElementById(
                "searchText"
            ).addEventListener(
                "input",
                refresh
            );

            document.getElementById(
                "saveEditBookingBtn"
            ).addEventListener(
                "click",
                saveEditBooking
            );

            document.getElementById(
                "cancelEditBookingBtn"
            ).addEventListener(
                "click",
                hideEditBooking
            );

            console.log(
                "ACCT-002 Bookings Financial View loaded:",
                allBookings.length,
                "booking(s)"
            );

        } catch (error) {

            console.error(
                "ACCT-002 initialization error:",
                error
            );

            document.getElementById(
                "loadingMessage"
            ).style.display = "none";

            showError(
                error.message ||
                "Unable to load booking financial data."
            );
        }
    };

    window.addEventListener(
        "DOMContentLoaded",
        init
    );






    // ============================================
    // Admin Add Booking - UI Controls
    // ============================================

    const addBookingBtn = document.getElementById("addBookingBtn");
    const addBookingPanel = document.getElementById("addBookingPanel");
    const cancelAddBookingBtn = document.getElementById("cancelAddBookingBtn");

    if (addBookingBtn && addBookingPanel) {
        addBookingBtn.addEventListener("click", () => {
            addBookingPanel.style.display = "block";
            addBookingPanel.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    }

    if (cancelAddBookingBtn && addBookingPanel) {
        cancelAddBookingBtn.addEventListener("click", () => {
            addBookingPanel.style.display = "none";
        });
    }

    // ============================================
    // Admin Add Booking - Pricing Calculation
    // ============================================

    function formatBookingCurrency(amount, currency) {
        const value = Number(amount) || 0;
        return currency + " " + value.toFixed(2);
    }

    function updateBookingExchangeRateField() {
        const currencyElement = document.getElementById("addBookingCurrency");
        const exchangeRateElement = document.getElementById("addExchangeRate");
        const exchangeRateLabel = document.getElementById("addExchangeRateLabel");

        if (!currencyElement || !exchangeRateElement) {
            return;
        }

        const currency = currencyElement.value || "";
        const previousCurrency = currencyElement.dataset.previousCurrency || "";

        if (!currency) {
            if (previousCurrency) {
                exchangeRateElement.value = "";
            }
            exchangeRateElement.disabled = false;
        } else if (currency === "LKR") {
            exchangeRateElement.value = "1";
            exchangeRateElement.disabled = true;
        } else {
            if (!previousCurrency || previousCurrency !== currency) {
                const defaultRate = DEFAULT_EXCHANGE_RATES_TO_LKR[currency];
                exchangeRateElement.value = defaultRate
                    ? String(defaultRate)
                    : "";
            }
            exchangeRateElement.disabled = false;
        }

        if (exchangeRateLabel) {
            exchangeRateLabel.textContent = currency === "LKR"
                ? "Exchange Rate (not required for LKR)"
                : `Exchange Rate (1 ${currency} = LKR)`;
        }

        currencyElement.dataset.previousCurrency = currency;
    }

    function calculateAdminBookingPricing() {
        const accommodation = parseFloat(document.getElementById("addAccommodation")?.value) || 0;
        const extraGuestFee = parseFloat(document.getElementById("addExtraGuestFee")?.value) || 0;
        const cleaningFee = parseFloat(document.getElementById("addCleaningFee")?.value) || 0;
        const currency = document.getElementById("addBookingCurrency")?.value || CONFIG?.pricing?.currency || "AUD";
        const exchangeRate = Number(document.getElementById("addExchangeRate")?.value) || 0;
        const total = accommodation + extraGuestFee + cleaningFee;
        const depositPercentage = Number(CONFIG?.payment?.depositPercentage) || 30;
        const deposit = total * (depositPercentage / 100);
        const balance = total - deposit;
        const totalLkr = currency === "LKR" ? total : total * exchangeRate;
        const depositLkr = currency === "LKR" ? deposit : deposit * exchangeRate;
        const balanceLkr = currency === "LKR" ? balance : balance * exchangeRate;

        const totalElement = document.getElementById("addTotal");
        const depositElement = document.getElementById("addDepositAmount");
        const balanceElement = document.getElementById("addBalanceAmount");
        const totalLkrElement = document.getElementById("addTotalLkr");
        const depositLkrElement = document.getElementById("addDepositAmountLkr");
        const balanceLkrElement = document.getElementById("addBalanceAmountLkr");

        if (totalElement) totalElement.textContent = formatBookingCurrency(total, currency);
        if (depositElement) depositElement.textContent = formatBookingCurrency(deposit, currency);
        if (balanceElement) balanceElement.textContent = formatBookingCurrency(balance, currency);
        if (totalLkrElement) totalLkrElement.textContent = formatBookingCurrency(totalLkr, "LKR");
        if (depositLkrElement) depositLkrElement.textContent = formatBookingCurrency(depositLkr, "LKR");
        if (balanceLkrElement) balanceLkrElement.textContent = formatBookingCurrency(balanceLkr, "LKR");
    }

    ["addAccommodation", "addExtraGuestFee", "addCleaningFee"].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("input", calculateAdminBookingPricing);
        }
    });

    const addBookingCurrencyElement = document.getElementById("addBookingCurrency");
    if (addBookingCurrencyElement) {
        addBookingCurrencyElement.addEventListener("change", () => {
            updateBookingExchangeRateField();
            calculateAdminBookingPricing();
        });
    }

    const addExchangeRateElement = document.getElementById("addExchangeRate");
    if (addExchangeRateElement) {
        addExchangeRateElement.addEventListener("input", calculateAdminBookingPricing);
        addExchangeRateElement.addEventListener("change", calculateAdminBookingPricing);
    }

    updateBookingExchangeRateField();
    calculateAdminBookingPricing();

    // ============================================
    // Admin Add Booking - Actual Payment Calculation
    // ============================================

    function calculateAdminPaymentAmounts() {
        const calculatePaymentLkr = (
            amountElementId,
            currencyElementId,
            exchangeRateElementId,
            outputElementId
        ) => {
            const amount =
                Number(document.getElementById(amountElementId)?.value) || 0;

            const currency =
                document.getElementById(currencyElementId)?.value || "";

            const exchangeRate =
                Number(document.getElementById(exchangeRateElementId)?.value) || 0;

            let amountLkr = 0;

            if (amount > 0 && currency) {
                amountLkr =
                    currency === "LKR"
                        ? amount
                        : amount * exchangeRate;
            }

            const outputElement =
                document.getElementById(outputElementId);

            if (outputElement) {
                outputElement.textContent =
                    formatBookingCurrency(amountLkr, "LKR");
            }
        };

        calculatePaymentLkr(
            "addDepositPaymentAmount",
            "addDepositPaymentCurrency",
            "addDepositPaymentExchangeRate",
            "addDepositPaymentAmountLkr"
        );

        calculatePaymentLkr(
            "addBalancePaymentAmount",
            "addBalancePaymentCurrency",
            "addBalancePaymentExchangeRate",
            "addBalancePaymentAmountLkr"
        );
    }

    function updatePaymentExchangeRateField(
        currencyElementId,
        exchangeRateElementId
    ) {
        const currencyElement = document.getElementById(currencyElementId);
        const exchangeRateElement = document.getElementById(exchangeRateElementId);

        if (!currencyElement || !exchangeRateElement) {
            return;
        }

        const currency = currencyElement.value || "";
        const previousCurrency = currencyElement.dataset.previousCurrency || "";

        if (!currency) {
            if (previousCurrency) {
                exchangeRateElement.value = "";
            }
            exchangeRateElement.disabled = false;
        } else if (currency === "LKR") {
            exchangeRateElement.value = "1";
            exchangeRateElement.disabled = true;
        } else {
            if (!previousCurrency || previousCurrency !== currency) {
                const defaultRate = DEFAULT_EXCHANGE_RATES_TO_LKR[currency];
                exchangeRateElement.value = defaultRate
                    ? String(defaultRate)
                    : "";
            }
            exchangeRateElement.disabled = false;
        }

        currencyElement.dataset.previousCurrency = currency;
    }

    function resetPaymentExchangeRateOnCurrencyChange(
        currencyElementId,
        exchangeRateElementId,
        recalculate
    ) {
        const currencyElement =
            document.getElementById(currencyElementId);

        if (!currencyElement) {
            return;
        }

        const handleCurrencyChange = () => {
            updatePaymentExchangeRateField(
                currencyElementId,
                exchangeRateElementId
            );
            recalculate();
        };

        currencyElement.addEventListener("change", handleCurrencyChange);
        updatePaymentExchangeRateField(
            currencyElementId,
            exchangeRateElementId
        );
    }

    resetPaymentExchangeRateOnCurrencyChange(
        "addDepositPaymentCurrency",
        "addDepositPaymentExchangeRate",
        calculateAdminPaymentAmounts
    );
    resetPaymentExchangeRateOnCurrencyChange(
        "addBalancePaymentCurrency",
        "addBalancePaymentExchangeRate",
        calculateAdminPaymentAmounts
    );

    [
        "addDepositPaymentAmount",
        "addDepositPaymentCurrency",
        "addDepositPaymentExchangeRate",
        "addBalancePaymentAmount",
        "addBalancePaymentCurrency",
        "addBalancePaymentExchangeRate"
    ].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener(
                "input",
                calculateAdminPaymentAmounts
            );

            if (!id.endsWith("Currency")) {
                element.addEventListener(
                    "change",
                    calculateAdminPaymentAmounts
                );
            }
        }
    });

    calculateAdminPaymentAmounts();

    // ============================================
    // Admin Edit Booking - Payment Calculation
    // ============================================

    function calculateEditPaymentAmounts() {
        const calculatePaymentLkr = (
            amountElementId,
            currencyElementId,
            exchangeRateElementId,
            outputElementId
        ) => {
            const amount =
                Number(
                    document.getElementById(amountElementId)?.value
                ) || 0;

            const currency =
                document.getElementById(currencyElementId)?.value || "";

            const exchangeRate =
                Number(
                    document.getElementById(exchangeRateElementId)?.value
                ) || 0;

            let amountLkr = 0;

            if (amount > 0 && currency) {
                amountLkr =
                    currency === "LKR"
                        ? amount
                        : amount * exchangeRate;
            }

            const outputElement =
                document.getElementById(outputElementId);

            if (outputElement) {
                outputElement.textContent =
                    formatBookingCurrency(amountLkr, "LKR");
            }
        };

        calculatePaymentLkr(
            "editDepositPaymentAmount",
            "editDepositPaymentCurrency",
            "editDepositPaymentExchangeRate",
            "editDepositPaymentAmountLkr"
        );

        calculatePaymentLkr(
            "editBalancePaymentAmount",
            "editBalancePaymentCurrency",
            "editBalancePaymentExchangeRate",
            "editBalancePaymentAmountLkr"
        );
    }

    resetPaymentExchangeRateOnCurrencyChange(
        "editDepositPaymentCurrency",
        "editDepositPaymentExchangeRate",
        calculateEditPaymentAmounts
    );
    resetPaymentExchangeRateOnCurrencyChange(
        "editBalancePaymentCurrency",
        "editBalancePaymentExchangeRate",
        calculateEditPaymentAmounts
    );

    [
        "editDepositPaymentAmount",
        "editDepositPaymentCurrency",
        "editDepositPaymentExchangeRate",
        "editBalancePaymentAmount",
        "editBalancePaymentCurrency",
        "editBalancePaymentExchangeRate"
    ].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener(
                "input",
                calculateEditPaymentAmounts
            );

            if (!id.endsWith("Currency")) {
                element.addEventListener(
                    "change",
                    calculateEditPaymentAmounts
                );
            }
        }
    });

    calculateEditPaymentAmounts();
    // ============================================
    // Admin Add Booking - Nights Calculation
    // ============================================

    function calculateAdminBookingNights() {
        const checkin = document.getElementById("addCheckin")?.value;
        const checkout = document.getElementById("addCheckout")?.value;
        const nightsElement = document.getElementById("addNights");

        if (!nightsElement) {
            return 0;
        }

        if (!checkin || !checkout) {
            nightsElement.textContent = "0";
            return 0;
        }

        const [checkinYear, checkinMonth, checkinDay] = checkin.split("-").map(Number);
        const [checkoutYear, checkoutMonth, checkoutDay] = checkout.split("-").map(Number);

        const checkinDate = Date.UTC(checkinYear, checkinMonth - 1, checkinDay);
        const checkoutDate = Date.UTC(checkoutYear, checkoutMonth - 1, checkoutDay);

        const difference = checkoutDate - checkinDate;
        const nights = difference / (1000 * 60 * 60 * 24);

        if (nights <= 0) {
            nightsElement.textContent = "0";
            return 0;
        }

        nightsElement.textContent = String(nights);
        return nights;
    }

    ["addCheckin", "addCheckout"].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("change", calculateAdminBookingNights);
        }
    });

    calculateAdminBookingNights();

    // ============================================
    // Admin Add Booking - Default Accommodation
    // ============================================

    function calculateAdminAccommodation() {
        const nights = calculateAdminBookingNights();
        const accommodationElement = document.getElementById("addAccommodation");

        if (!accommodationElement || nights <= 0) {
            return;
        }

        const nightlyRate = Number(CONFIG?.pricing?.nightlyRate) || 0;

        accommodationElement.value = (nights * nightlyRate).toFixed(2);

        if (typeof calculateAdminBookingPricing === "function") {
            calculateAdminBookingPricing();
        }
    }

    ["addCheckin", "addCheckout"].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("change", calculateAdminAccommodation);
        }
    });

    // ============================================
    // Admin Add Booking - Extra Guest Fee
    // ============================================

    function calculateAdminExtraGuestFee() {
        const adults = Number(document.getElementById("addAdults")?.value) || 0;
        const children = Number(document.getElementById("addChildren")?.value) || 0;
        const nights = calculateAdminBookingNights();
        const extraGuestElement = document.getElementById("addExtraGuestFee");

        if (!extraGuestElement) {
            return;
        }

        const totalGuests = adults + children;
        const baseOccupancy = 7;
        const extraGuestRate = Number(CONFIG?.pricing?.extraGuestRate) || 0;

        const extraGuests = Math.max(0, totalGuests - baseOccupancy);
        const extraGuestFee = extraGuests * extraGuestRate * Math.max(0, nights);

        extraGuestElement.value = extraGuestFee.toFixed(2);

        if (typeof calculateAdminBookingPricing === "function") {
            calculateAdminBookingPricing();
        }
    }

    ["addAdults", "addChildren", "addCheckin", "addCheckout"].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("change", calculateAdminExtraGuestFee);
        }
    });

    calculateAdminExtraGuestFee();

    // ============================================
    // Admin Add Booking - Guest Validation
    // ============================================

    function updateAdminTotalGuests() {
    const adults =
        Number(document.getElementById("addAdults")?.value) || 0;

    const children =
        Number(document.getElementById("addChildren")?.value) || 0;

    const totalGuests = adults + children;

    const totalGuestsElement =
        document.getElementById("addTotalGuests");

    if (totalGuestsElement) {
        totalGuestsElement.value = totalGuests;
    }

    return totalGuests;
}

function validateAdminGuestCount() {
        const adultsElement = document.getElementById("addAdults");
        const childrenElement = document.getElementById("addChildren");
        const errorElement = document.getElementById("addBookingError");

        const adults = Number(adultsElement?.value) || 0;
        const children = Number(childrenElement?.value) || 0;
        const totalGuests = adults + children;
        const maxGuests = Number(CONFIG?.villa?.maxGuests) || 9;

        if (adults < 1) {
            if (errorElement) {
                errorElement.textContent = "At least 1 adult is required.";
                errorElement.style.display = "block";
            }
            return false;
        }

        if (totalGuests > maxGuests) {
            if (errorElement) {
                errorElement.textContent =
                    `Maximum ${maxGuests} guests are allowed. Current guest count: ${totalGuests}.`;
                errorElement.style.display = "block";
            }
            return false;
        }

        if (errorElement) {
            errorElement.textContent = "";
            errorElement.style.display = "none";
        }

        return true;
    }

    ["addAdults", "addChildren"].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("input", validateAdminGuestCount);
            element.addEventListener("change", validateAdminGuestCount);
        }
    });

    validateAdminGuestCount();

    // ============================================
    // Admin Add Booking - Date Validation
    // ============================================

    function validateAdminBookingDates() {
        const checkin = document.getElementById("addCheckin")?.value;
        const checkout = document.getElementById("addCheckout")?.value;
        const errorElement = document.getElementById("addBookingError");

        if (!checkin || !checkout) {
            if (errorElement) {
                errorElement.textContent = "";
                errorElement.style.display = "none";
            }
            return false;
        }

        const [checkinYear, checkinMonth, checkinDay] = checkin.split("-").map(Number);
        const [checkoutYear, checkoutMonth, checkoutDay] = checkout.split("-").map(Number);

        const checkinDate = Date.UTC(checkinYear, checkinMonth - 1, checkinDay);
        const checkoutDate = Date.UTC(checkoutYear, checkoutMonth - 1, checkoutDay);

        if (checkoutDate <= checkinDate) {
            if (errorElement) {
                errorElement.textContent = "Check-out date must be after the check-in date.";
                errorElement.style.display = "block";
            }
            return false;
        }

        if (errorElement) {
            errorElement.textContent = "";
            errorElement.style.display = "none";
        }

        return true;
    }

    ["addCheckin", "addCheckout"].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("change", validateAdminBookingDates);
        }
    });

    validateAdminBookingDates();


const adminAdultsInput = document.getElementById("addAdults");
const adminChildrenInput = document.getElementById("addChildren");

if (adminAdultsInput) {
    adminAdultsInput.addEventListener("input", () => {
        updateAdminTotalGuests();
        validateAdminGuestCount();
    });
}

if (adminChildrenInput) {
    adminChildrenInput.addEventListener("input", () => {
        updateAdminTotalGuests();
        validateAdminGuestCount();
    });
}

updateAdminTotalGuests();
    // ============================================
    // Admin Add Booking - Save Validation Hook
    // ============================================

    const saveBookingBtn = document.getElementById("saveBookingBtn");
    let isSavingAdminBooking = false;

    if (saveBookingBtn) {
        saveBookingBtn.addEventListener("click", async () => {
            if (isSavingAdminBooking) {
                return;
            }

            isSavingAdminBooking = true;

            saveBookingBtn.disabled = true;

            saveBookingBtn.textContent = "Checking availability...";
            const datesValid = validateAdminBookingDates();
            const guestsValid = validateAdminGuestCount();
            const guestInformationValid = validateAdminGuestInformation();

            if (!datesValid || !guestsValid || !guestInformationValid) {
                document.getElementById("addBookingError")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
                isSavingAdminBooking = false;
                saveBookingBtn.disabled = false;
                saveBookingBtn.textContent = "Save Booking";
                return;
            }

            let activeBookings;

            try {
                activeBookings = await getActiveBookings();
            } catch (error) {
                console.error("Unable to check booking availability:", error);

                const errorElement = document.getElementById("addBookingError");

                if (errorElement) {
                    errorElement.textContent =
                        "Unable to check booking availability. Please try again. " +
                        (error.message || String(error));
                    errorElement.style.display = "block";
                }

                document.getElementById("addBookingError")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

                isSavingAdminBooking = false;

                saveBookingBtn.disabled = false;

                saveBookingBtn.textContent = "Save Booking";
                return;
            }

            const checkin = document.getElementById("addCheckin")?.value || "";
            const checkout = document.getElementById("addCheckout")?.value || "";

            const conflict = activeBookings.some(existingBooking => {
                if (!existingBooking.checkin || !existingBooking.checkout) {
                    return false;
                }

                return (
                    existingBooking.checkin < checkout &&
                    existingBooking.checkout > checkin
                );
            });

            if (conflict) {
                const errorElement = document.getElementById("addBookingError");

                if (errorElement) {
                    errorElement.textContent =
                        "The selected dates are not available. An existing Pending or Confirmed booking overlaps these dates.";
                    errorElement.style.display = "block";
                }

                document.getElementById("addBookingError")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

                isSavingAdminBooking = false;

                saveBookingBtn.disabled = false;

                saveBookingBtn.textContent = "Save Booking";
                return;
            }

            // ============================================
            // Build and save Admin Booking
            // ============================================

            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            const randomNumber = Math.floor(1000 + Math.random() * 9000);

            const bookingReference =
                `JSV-${year}${month}${day}-${randomNumber}`;


            const adults =
                Number(document.getElementById("addAdults")?.value) || 0;

            const children =
                Number(document.getElementById("addChildren")?.value) || 0;

            const totalGuests =
                Number(document.getElementById("addTotalGuests")?.value) ||
                adults + children;

            const nights =
                Number(document.getElementById("addNights")?.textContent) || 0;

            const accommodation =
                Number(document.getElementById("addAccommodation")?.value) || 0;

            const extraGuestFee =
                Number(document.getElementById("addExtraGuestFee")?.value) || 0;

            const cleaningFee =
                Number(document.getElementById("addCleaningFee")?.value) || 0;

            const total =
                accommodation + extraGuestFee + cleaningFee;

            const depositAmount =
                Number(
                    document
                        .getElementById("addDepositAmount")
                        ?.textContent
                        ?.replace(/[^0-9.-]/g, "")
                ) || 0;

            const balanceAmount =
                Number(
                    document
                        .getElementById("addBalanceAmount")
                        ?.textContent
                        ?.replace(/[^0-9.-]/g, "")
                ) || 0;

            const bookingCurrency = document.getElementById("addBookingCurrency")?.value || CONFIG.pricing.currency;
            const exchangeRate = bookingCurrency === "LKR" ? 1 : Number(document.getElementById("addExchangeRate")?.value) || 0;
            const exchangeRateDate = document.getElementById("addExchangeRateDate")?.value || "";

            if (
                bookingCurrency !== "LKR" &&
                !isPositiveFiniteNumber(exchangeRate)
            ) {
                const errorElement = document.getElementById("addBookingError");
                if (errorElement) {
                    errorElement.textContent =
                        `A valid ${bookingCurrency}-to-LKR exchange rate is required.`;
                    errorElement.style.display = "block";
                    errorElement.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
                }

                isSavingAdminBooking = false;
                saveBookingBtn.disabled = false;
                saveBookingBtn.textContent = "Save Booking";
                return;
            }

            const totalLkr = calculateLkrEquivalent(total, exchangeRate);
            const depositAmountLkr = calculateLkrEquivalent(
                depositAmount,
                exchangeRate
            );
            const balanceAmountLkr = calculateLkrEquivalent(
                balanceAmount,
                exchangeRate
            );

            if (
                totalLkr === null ||
                depositAmountLkr === null ||
                balanceAmountLkr === null ||
                totalLkr <= 0
            ) {
                const errorElement = document.getElementById("addBookingError");
                if (errorElement) {
                    errorElement.textContent =
                        "Booking LKR equivalents must be finite valid amounts.";
                    errorElement.style.display = "block";
                }

                isSavingAdminBooking = false;
                saveBookingBtn.disabled = false;
                saveBookingBtn.textContent = "Save Booking";
                return;
            }

            const depositPaymentStatus =
                document.getElementById("addDepositPaymentStatus")?.value ||
                "Not Paid";

            const depositPaymentCurrency =
                document.getElementById("addDepositPaymentCurrency")?.value ||
                "";

            const depositPaymentAmount =
                Number(
                    document.getElementById("addDepositPaymentAmount")?.value
                ) || 0;

            const depositPaymentDate =
                document.getElementById("addDepositPaymentDate")?.value ||
                "";

            const depositPaymentExchangeRateToLkr =
                depositPaymentCurrency === "LKR"
                    ? 1
                    : Number(
                        document.getElementById(
                            "addDepositPaymentExchangeRate"
                        )?.value
                    ) || 0;

            const depositPaymentAmountLkr = calculateLkrEquivalent(
                depositPaymentAmount,
                depositPaymentExchangeRateToLkr
            );

            const balancePaymentStatus =
                document.getElementById("addBalancePaymentStatus")?.value ||
                "Not Paid";

            const balancePaymentCurrency =
                document.getElementById("addBalancePaymentCurrency")?.value ||
                "";

            const balancePaymentAmount =
                Number(
                    document.getElementById("addBalancePaymentAmount")?.value
                ) || 0;

            const balancePaymentDate =
                document.getElementById("addBalancePaymentDate")?.value ||
                "";

            const balancePaymentExchangeRateToLkr =
                balancePaymentCurrency === "LKR"
                    ? 1
                    : Number(
                        document.getElementById(
                            "addBalancePaymentExchangeRate"
                        )?.value
                    ) || 0;

            const balancePaymentAmountLkr = calculateLkrEquivalent(
                balancePaymentAmount,
                balancePaymentExchangeRateToLkr
            );

            const addPaymentError =
                document.getElementById("addBookingError");

            const validateActualPayment = (
                paymentName,
                status,
                currency,
                amount,
                paymentDate,
                exchangeRate,
                amountLkr
            ) => {
                if (amountLkr === null) {
                    if (addPaymentError) {
                        addPaymentError.textContent =
                            `${paymentName} LKR equivalent must be a finite, non-negative amount.`;
                        addPaymentError.style.display = "block";
                    }
                    return false;
                }

                if (status !== "Paid") {
                    return true;
                }

                if (!Number.isFinite(amountLkr) || amountLkr <= 0) {
                    if (addPaymentError) {
                        addPaymentError.textContent =
                            `${paymentName} LKR equivalent must be greater than zero.`;
                        addPaymentError.style.display = "block";
                    }
                    return false;
                }

                if (!currency) {
                    if (addPaymentError) {
                        addPaymentError.textContent =
                            `${paymentName} currency is required when the payment status is Paid.`;
                        addPaymentError.style.display = "block";
                    }
                    return false;
                }

                if (!Number.isFinite(amount) || amount <= 0) {
                    if (addPaymentError) {
                        addPaymentError.textContent =
                            `${paymentName} amount must be greater than zero.`;
                        addPaymentError.style.display = "block";
                    }
                    return false;
                }

                if (!paymentDate) {
                    if (addPaymentError) {
                        addPaymentError.textContent =
                            `${paymentName} date is required.`;
                        addPaymentError.style.display = "block";
                    }
                    return false;
                }

                if (
                    currency !== "LKR" &&
                    !isPositiveFiniteNumber(exchangeRate)
                ) {
                    if (addPaymentError) {
                        addPaymentError.textContent =
                            `${paymentName} exchange rate to LKR is required for ${currency} payments.`;
                        addPaymentError.style.display = "block";
                    }
                    return false;
                }

                return true;
            };

            if (
                !validateActualPayment(
                    "Deposit payment",
                    depositPaymentStatus,
                    depositPaymentCurrency,
                    depositPaymentAmount,
                    depositPaymentDate,
                    depositPaymentExchangeRateToLkr,
                    depositPaymentAmountLkr
                ) ||
                !validateActualPayment(
                    "Balance payment",
                    balancePaymentStatus,
                    balancePaymentCurrency,
                    balancePaymentAmount,
                    balancePaymentDate,
                    balancePaymentExchangeRateToLkr,
                    balancePaymentAmountLkr
                )
            ) {
                addPaymentError?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
                isSavingAdminBooking = false;
                saveBookingBtn.disabled = false;
                saveBookingBtn.textContent = "Save Booking";
                return;
            }

            const bookingData = {
                bookingReference,

                guestName:
                    document.getElementById("addGuestName")?.value.trim() || "",

                email:
                    document.getElementById("addEmail")?.value.trim() || "",

                phone:
                    document.getElementById("addPhone")?.value.trim() || "",

                country:
                    document.getElementById("addCountry")?.value.trim() || "",

                checkin,
                checkout,

                adults,
                children,
                totalGuests,
                nights,

                arrivalTime:
                    document.getElementById("addArrivalTime")?.value || "",

                specialRequests:
                    document.getElementById("addSpecialRequests")?.value.trim() || "",

                accommodation,
                extraGuestFee,
                cleaningFee,
                total,

                currency: bookingCurrency,
                reportingCurrency: CONFIG.pricing.reportingCurrency || "LKR",
                exchangeRateToLkr: exchangeRate,
                exchangeRateDate,
                totalLkr,
                depositAmountLkr,
                balanceAmountLkr,

                depositPercentage:
                    Number(CONFIG.payment.depositPercentage) || 0,

                depositAmount,
                balanceAmount,

                balanceDueHoursBeforeCheckin:
                    Number(CONFIG.payment.balanceDueHoursBeforeCheckin) || 24,

                balanceGracePeriodHours:
                    Number(CONFIG.payment.balanceGracePeriodHours) || 48,

                paymentStatus: calculateOverallPaymentStatus(
                    totalLkr,
                    depositPaymentStatus === "Paid" ? depositPaymentAmountLkr : 0,
                    balancePaymentStatus === "Paid" ? balancePaymentAmountLkr : 0
                ),

                depositPaid:
                    depositPaymentStatus === "Paid",

                balancePaid:
                    balancePaymentStatus === "Paid",

                depositPaymentStatus,
                depositPaymentAmount,
                depositPaymentCurrency,
                depositPaymentDate,
                depositPaymentExchangeRateToLkr,
                depositPaymentAmountLkr,

                balancePaymentStatus,
                balancePaymentAmount,
                balancePaymentCurrency,
                balancePaymentDate,
                balancePaymentExchangeRateToLkr,
                balancePaymentAmountLkr,

                status:
                    document.getElementById("addBookingStatus")?.value ||
                    CONFIG.bookingStatus.pending,

                bookingSource:
                    document.getElementById("addBookingSource")?.value ||
                    "Manual",

                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                saveBookingBtn.textContent = "Saving...";
                const docRef =
                    await db
                        .collection(CONFIG.firestore.bookingsCollection)
                        .add(bookingData);

                console.log(
                    "Admin booking saved successfully:",
                    bookingReference,
                    docRef.id
                );

                alert(
                    `Booking saved successfully.\n\nBooking Reference: ${bookingReference}`
                );

                const panel =
                    document.getElementById("addBookingPanel");

                if (panel) {
                    panel.style.display = "none";
                }

                await loadBookings();

            } catch (error) {
                console.error(
                    "Unable to save Admin booking:",
                    error
                );

                const errorElement =
                    document.getElementById("addBookingError");

                if (errorElement) {
                    errorElement.textContent =
                        `Unable to save booking: ${error.message || error}`;

                    errorElement.style.display = "block";
                }

                document
                    .getElementById("addBookingError")
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

            } finally {
                isSavingAdminBooking = false;
                saveBookingBtn.disabled = false;
                saveBookingBtn.textContent = "Save Booking";
            }
        });
    }

    // ============================================
    // Admin Add Booking - Guest Information Validation
    // ============================================

    function validateAdminGuestInformation() {
        const guestName = document.getElementById("addGuestName")?.value.trim();
        const errorElement = document.getElementById("addBookingError");

        if (!guestName) {
            if (errorElement) {
                errorElement.textContent = "Guest full name is required.";
                errorElement.style.display = "block";
            }
            return false;
        }

        if (errorElement) {
            errorElement.textContent = "";
            errorElement.style.display = "none";
        }

        return true;
    }








    const getActiveBookings = async () => {
        const config = window.CONFIG || {};
        const collectionName =
            config.firestore?.bookingsCollection ||
            window.APP_CONFIG?.firestore?.bookingsCollection ||
            "bookings";

        const snapshot = await db
            .collection(collectionName)
            .get();

        return snapshot.docs
            .map((doc) => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter((booking) =>
                String(booking.status || "").toLowerCase() !== "cancelled"
            );
    };

})();
