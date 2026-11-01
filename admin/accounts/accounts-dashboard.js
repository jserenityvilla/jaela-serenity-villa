(() => {
    "use strict";

    const db =
        window.db ||
        firebase.firestore();

    const bookingsCollection =
        window.APP_CONFIG?.bookingsCollection ||
        (window.CONFIG &&
            window.CONFIG.firestore &&
            window.CONFIG.firestore.bookingsCollection) ||
        "bookings";

    const expensesCollection =
        window.APP_CONFIG?.expensesCollection ||
        (window.CONFIG &&
            window.CONFIG.firestore &&
            window.CONFIG.firestore.expensesCollection) ||
        "expenses";

    const utilityBillsCollection =
        window.APP_CONFIG?.utilityBillsCollection ||
        (window.CONFIG &&
            window.CONFIG.firestore &&
            window.CONFIG.firestore.utilityBillsCollection) ||
        "utilityBills";

    const state = {
        bookings: [],
        expenses: [],
        utilityBills: []
    };

    function parseFiniteNumber(value) {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        if (typeof value !== "string") {
            return null;
        }

        const trimmed = value.trim();
        if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
            return null;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function addFiniteNumbers(total, amount) {
        const safeTotal = parseFiniteNumber(total) ?? 0;
        const safeAmount = parseFiniteNumber(amount) ?? 0;
        const result = safeTotal + safeAmount;

        return Number.isFinite(result) ? result : safeTotal;
    }

    function multiplyFiniteNumbers(left, right) {
        const safeLeft = parseFiniteNumber(left);
        const safeRight = parseFiniteNumber(right);

        if (safeLeft === null || safeRight === null) {
            return null;
        }

        const result = safeLeft * safeRight;
        return Number.isFinite(result) ? result : null;
    }

    function divideFiniteNumbers(numerator, denominator) {
        const safeNumerator = parseFiniteNumber(numerator);
        const safeDenominator = parseFiniteNumber(denominator);

        if (safeNumerator === null || safeDenominator === null || safeDenominator === 0) {
            return 0;
        }

        const result = safeNumerator / safeDenominator;
        return Number.isFinite(result) ? result : 0;
    }

    function getValidExchangeRate(currency, value) {
        if (String(currency || "AUD").toUpperCase() === "LKR") {
            return 1;
        }

        const rate = parseFiniteNumber(value);
        return rate !== null && rate > 0 ? rate : null;
    }

    function getLkrEquivalent(amount, currency, exchangeRate, storedAmountLkr) {
        const stored = parseFiniteNumber(storedAmountLkr);
        if (stored !== null) {
            return stored;
        }

        const parsedAmount = parseFiniteNumber(amount);
        if (parsedAmount === null) {
            return null;
        }

        const normalizedCurrency = String(currency || "AUD").toUpperCase();
        if (normalizedCurrency === "LKR") {
            return parsedAmount;
        }

        const rate = getValidExchangeRate(normalizedCurrency, exchangeRate);
        return rate === null
            ? null
            : multiplyFiniteNumbers(parsedAmount, rate);
    }

    function money(value) {
        return new Intl.NumberFormat(
            "en-LK",
            {
                style: "currency",
                currency: "LKR",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(Number(value) || 0);
    }

    function number(value) {
        return new Intl.NumberFormat(
            "en-AU"
        ).format(Number(value) || 0);
    }

    function decimal(value) {
        return (
            Number(value) || 0
        ).toFixed(1);
    }

    function percentage(value) {
        return `${(
            Number(value) || 0
        ).toFixed(1)}%`;
    }

    function parseDate(value) {
        if (!value) {
            return null;
        }

        if (typeof value === "string") {
            const date =
                new Date(
                    `${value}T00:00:00`
                );

            return Number.isNaN(
                date.getTime()
            )
                ? null
                : date;
        }

        if (
            value &&
            typeof value.toDate ===
                "function"
        ) {
            return value.toDate();
        }

        const date =
            new Date(value);

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;
    }

    function formatDate(date) {
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return year + "-" + month + "-" + day;
    }

    function startOfMonth(date) {
        return new Date(
            date.getFullYear(),
            date.getMonth(),
            1
        );
    }

    function endOfMonth(date) {
        return new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0
        );
    }

    function startOfQuarter(date) {
        const month =
            Math.floor(
                date.getMonth() / 3
            ) * 3;

        return new Date(
            date.getFullYear(),
            month,
            1
        );
    }

    function endOfQuarter(date) {
        const month =
            Math.floor(
                date.getMonth() / 3
            ) * 3;

        return new Date(
            date.getFullYear(),
            month + 3,
            0
        );
    }

    function startOfYear(date) {
        return new Date(
            date.getFullYear(),
            0,
            1
        );
    }

    function endOfYear(date) {
        return new Date(
            date.getFullYear(),
            11,
            31
        );
    }

    function addDays(date, days) {
        const result =
            new Date(date);

        result.setDate(
            result.getDate() + days
        );

        return result;
    }

    function daysBetween(
        from,
        to
    ) {
        const milliseconds =
            24 *
            60 *
            60 *
            1000;

        return Math.max(
            0,
            Math.round(
                (
                    to.getTime() -
                    from.getTime()
                ) / milliseconds
            )
        );
    }

    function getPeriod() {
        const selector =
            document.getElementById(
                "periodSelector"
            );

        const value =
            selector
                ? selector.value
                : "month";

        const today =
            new Date();

        let from;
        let to;

        switch (value) {
            case "quarter":
                from =
                    startOfQuarter(
                        today
                    );

                to =
                    endOfQuarter(
                        today
                    );

                break;

            case "year":
                from =
                    startOfYear(
                        today
                    );

                to =
                    endOfYear(
                        today
                    );

                break;

            case "custom": {
                const fromValue =
                    document.getElementById(
                        "customFrom"
                    )?.value;

                const toValue =
                    document.getElementById(
                        "customTo"
                    )?.value;

                if (
                    !fromValue ||
                    !toValue
                ) {
                    throw new Error(
                        "Please select both Custom Range dates."
                    );
                }

                from =
                    parseDate(
                        fromValue
                    );

                to =
                    parseDate(
                        toValue
                    );

                if (
                    !from ||
                    !to
                ) {
                    throw new Error(
                        "Please provide valid Custom Range dates."
                    );
                }

                if (
                    from > to
                ) {
                    throw new Error(
                        "Custom Range 'From' date cannot be after the 'To' date."
                    );
                }

                break;
            }

            case "month":
            default:
                from =
                    startOfMonth(
                        today
                    );

                to =
                    endOfMonth(
                        today
                    );

                break;
        }

        return {
            from,
            to
        };
    }

    function periodEndExclusive(
        period
    ) {
        return addDays(
            period.to,
            1
        );
    }

    function calculateOverlapNights(
        checkin,
        checkout,
        period
    ) {
        if (
            !checkin ||
            !checkout
        ) {
            return 0;
        }

        const endExclusive =
            periodEndExclusive(
                period
            );

        if (
            checkout <= period.from ||
            checkin >= endExclusive
        ) {
            return 0;
        }

        const start =
            checkin > period.from
                ? checkin
                : period.from;

        const end =
            checkout < endExclusive
                ? checkout
                : endExclusive;

        return daysBetween(
            start,
            end
        );
    }

    function isConfirmed(
        booking
    ) {
        return (
            String(
                booking.status || ""
            ).toLowerCase() ===
            "confirmed"
        );
    }

    function getConfirmedBookings(
        period
    ) {
        return state.bookings.filter(
            booking => {
                if (
                    !isConfirmed(
                        booking
                    )
                ) {
                    return false;
                }

                const checkin =
                    parseDate(
                        booking.checkin
                    );

                const checkout =
                    parseDate(
                        booking.checkout
                    );

                return (
                    calculateOverlapNights(
                        checkin,
                        checkout,
                        period
                    ) > 0
                );
            }
        );
    }

    function getGuestCount(
        booking
    ) {
        if (
            booking.totalGuests !==
                undefined &&
            booking.totalGuests !==
                null &&
            booking.totalGuests !==
                ""
        ) {
            const total =
                Number(
                    booking.totalGuests
                );

            if (
                Number.isFinite(
                    total
                ) &&
                total > 0
            ) {
                return total;
            }
        }

        const hasAdults =
            booking.adults !==
                undefined &&
            booking.adults !==
                null &&
            booking.adults !==
                "";

        const hasChildren =
            booking.children !==
                undefined &&
            booking.children !==
                null &&
            booking.children !==
                "";

        if (
            !hasAdults &&
            !hasChildren
        ) {
            return null;
        }

        const adults =
            parseFiniteNumber(booking.adults) ?? 0;

        const children =
            parseFiniteNumber(booking.children) ?? 0;

        const total = addFiniteNumbers(adults, children);

        return total > 0
            ? total
            : null;
    }

    function getBookingNights(
        booking,
        checkin,
        checkout
    ) {
        const storedNights =
            Number(
                booking.nights
            );

        if (
            Number.isFinite(
                storedNights
            ) &&
            storedNights > 0
        ) {
            return storedNights;
        }

        return daysBetween(
            checkin,
            checkout
        );
    }

    function getPeriodRevenue(
        booking,
        period,
        overlapNights,
        bookingNights
    ) {
        const currency =
            String(
                booking.currency || "AUD"
            ).toUpperCase();

        const amountFields = [
            "accommodation",
            "extraGuestFee",
            "cleaningFee"
        ];
        const originalAmounts = amountFields.map(
            field => {
                const amount = parseFiniteNumber(booking[field]);
                return amount !== null && amount >= 0 ? amount : 0;
            }
        );
        const componentStoredLkr = amountFields.map(
            field => {
                const amount = parseFiniteNumber(booking[field]);
                const amountLkr = parseFiniteNumber(booking[`${field}Lkr`]);

                return (
                    amount !== null &&
                    amount >= 0 &&
                    amountLkr !== null &&
                    amountLkr >= 0
                )
                    ? amountLkr
                    : null;
            }
        );

        let [accommodation, extraGuestFee, cleaningFeeAmount] = originalAmounts;

        if (currency !== "LKR") {
            const storedTotalLkr = parseFiniteNumber(booking.totalLkr);
            const originalTotal = originalAmounts.reduce(
                (total, amount) => total + amount,
                0
            );
            const storedTotalMatchesSign =
                storedTotalLkr !== null &&
                Number.isFinite(originalTotal) &&
                (
                    storedTotalLkr === 0
                        ? originalTotal === 0
                        : Math.sign(storedTotalLkr) === Math.sign(originalTotal)
                );
            const allComponentEquivalentsStored =
                componentStoredLkr.every(amount => amount !== null);

            if (allComponentEquivalentsStored) {
                [accommodation, extraGuestFee, cleaningFeeAmount] = componentStoredLkr;
            } else if (storedTotalMatchesSign && originalTotal !== 0) {
                [accommodation, extraGuestFee, cleaningFeeAmount] = originalAmounts.map(
                    amount =>
                        multiplyFiniteNumbers(
                            storedTotalLkr,
                            amount / originalTotal
                        ) ?? 0
                );
            } else {
                [accommodation, extraGuestFee, cleaningFeeAmount] = originalAmounts.map(
                    (amount, index) =>
                        getLkrEquivalent(
                            amount,
                            currency,
                            booking.exchangeRateToLkr,
                            componentStoredLkr[index]
                        ) ?? 0
                );
            }
        }

        const accommodationShare =
            bookingNights > 0
                ? multiplyFiniteNumbers(
                    accommodation,
                    overlapNights / bookingNights
                ) ?? 0
                : 0;

        const extraGuestShare =
            bookingNights > 0
                ? multiplyFiniteNumbers(
                    extraGuestFee,
                    overlapNights / bookingNights
                ) ?? 0
                : 0;

        let cleaningFee = 0;

        const checkout =
            parseDate(
                booking.checkout
            );

        if (
            checkout &&
            checkout >= period.from &&
            checkout <= period.to
        ) {
            cleaningFee = parseFiniteNumber(cleaningFeeAmount) ?? 0;
        }

        return {
            accommodation:
                accommodationShare,

            extraGuestFee:
                extraGuestShare,

            cleaningFee,

            total: addFiniteNumbers(
                addFiniteNumbers(accommodationShare, extraGuestShare),
                cleaningFee
            )
        };
    }

    function calculateIncome(
        bookings,
        period
    ) {
        let accommodation = 0;
        let extraGuestFee = 0;
        let cleaningFee = 0;
        let otherIncome = 0;

        let bookedNights = 0;

        let totalGuests = 0;
        let guestNights = 0;

        let guestDataBookings = 0;

        let totalStayNights = 0;

        bookings.forEach(
            booking => {
                const checkin =
                    parseDate(
                        booking.checkin
                    );

                const checkout =
                    parseDate(
                        booking.checkout
                    );

                const overlapNights =
                    calculateOverlapNights(
                        checkin,
                        checkout,
                        period
                    );

                if (
                    overlapNights <= 0
                ) {
                    return;
                }

                const bookingNights =
                    getBookingNights(
                        booking,
                        checkin,
                        checkout
                    );

                bookedNights = addFiniteNumbers(
                    bookedNights,
                    overlapNights
                );

                totalStayNights = addFiniteNumbers(
                    totalStayNights,
                    bookingNights
                );

                const revenue =
                    getPeriodRevenue(
                        booking,
                        period,
                        overlapNights,
                        bookingNights
                    );

                accommodation = addFiniteNumbers(
                    accommodation,
                    revenue.accommodation
                );

                extraGuestFee = addFiniteNumbers(
                    extraGuestFee,
                    revenue.extraGuestFee
                );

                cleaningFee = addFiniteNumbers(
                    cleaningFee,
                    revenue.cleaningFee
                );

                const guests =
                    getGuestCount(
                        booking
                    );

                if (
                    guests !== null
                ) {
                    guestDataBookings +=
                        1;

                    totalGuests = addFiniteNumbers(
                        totalGuests,
                        guests
                    );

                    guestNights = addFiniteNumbers(
                        guestNights,
                        multiplyFiniteNumbers(guests, overlapNights) ?? 0
                    );
                }
            }
        );

        const total = [
            accommodation,
            extraGuestFee,
            cleaningFee,
            otherIncome
        ].reduce(addFiniteNumbers, 0);

        return {
            accommodation,
            extraGuestFee,
            cleaningFee,
            otherIncome,
            total,
            bookedNights,
            totalGuests,
            guestNights,
            guestDataBookings,
            totalStayNights
        };
    }

    function calculateExpenses(
        period
    ) {
        const result = {
            bookingSpecific: 0,
            variableProperty: 0,
            fixedProperty: 0,
            other: 0,
            utilities: 0,
            missingConversions: 0
        };

        function parseFiniteNumber(value) {
            if (typeof value === "number") {
                return Number.isFinite(value) ? value : null;
            }
            if (typeof value !== "string") {
                return null;
            }

            const trimmed = value.trim();
            if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
                return null;
            }

            const parsed = Number(trimmed);
            return Number.isFinite(parsed) ? parsed : null;
        }

        function getAmountLkr(record) {
            const amount = parseFiniteNumber(record.amount);
            if (amount === null || amount < 0) {
                return null;
            }

            const currency = String(record.currency || "AUD").toUpperCase();
            if (currency === "LKR") {
                return amount;
            }
            if (currency !== "AUD") {
                return null;
            }

            const rate = parseFiniteNumber(record.exchangeRateToLkr);
            if (rate === null || rate <= 0) {
                return null;
            }

            const storedAmountLkr = parseFiniteNumber(record.amountLkr);
            const amountLkr = storedAmountLkr !== null && storedAmountLkr >= 0
                ? storedAmountLkr
                : Number((amount * rate).toFixed(2));
            return Number.isFinite(amountLkr) ? Number(amountLkr.toFixed(2)) : null;
        }

        state.expenses.forEach(
            expense => {
                const status =
                    String(
                        expense.status || ""
                    ).toLowerCase();

                if (
                    status !==
                    "active"
                ) {
                    return;
                }

                const date =
                    parseDate(
                        expense.expenseDate
                    );

                if (
                    !date ||
                    date < period.from ||
                    date > period.to
                ) {
                    return;
                }

                const amount = getAmountLkr(expense);
                if (amount === null) {
                    result.missingConversions += 1;
                    return;
                }

                const type =
                    String(
                        expense.expenseType ||
                        ""
                    ).toLowerCase();

                if (
                    type ===
                    "booking-specific"
                ) {
                    result.bookingSpecific = addFiniteNumbers(
                        result.bookingSpecific,
                        amount
                    );
                } else if (
                    type ===
                    "variable property"
                ) {
                    result.variableProperty = addFiniteNumbers(
                        result.variableProperty,
                        amount
                    );
                } else if (
                    type ===
                    "fixed property"
                ) {
                    result.fixedProperty = addFiniteNumbers(
                        result.fixedProperty,
                        amount
                    );
                } else {
                    result.other = addFiniteNumbers(
                        result.other,
                        amount
                    );
                }
            }
        );

        state.utilityBills.forEach(
            bill => {
                const status =
                    String(
                        bill.status || ""
                    ).toLowerCase();

                if (
                    status !==
                    "active"
                ) {
                    return;
                }

                const billDate =
                    parseDate(
                        bill.billDate
                    );

                if (
                    !billDate ||
                    billDate < period.from ||
                    billDate > period.to
                ) {
                    return;
                }

                const amount = getAmountLkr(bill);
                if (amount === null) {
                    result.missingConversions += 1;
                    return;
                }
                result.utilities = addFiniteNumbers(
                    result.utilities,
                    amount
                );
            }
        );

        result.total = [
            result.bookingSpecific,
            result.variableProperty,
            result.fixedProperty,
            result.other,
            result.utilities
        ].reduce(addFiniteNumbers, 0);

        return result;
    }

    function calculatePayments(
        bookings,
        period,
        receiptBookings
    ) {
        let depositsReceived = 0;
        let balancesReceived = 0;
        let outstanding = 0;

        const getPaymentAmountLkr = (
            booking,
            paymentType,
            legacyAmountField,
            legacyAmountLkrField
        ) => {
            const paymentPrefix = `${paymentType}Payment`;
            const rawPaymentAmount = booking[`${paymentPrefix}Amount`];
            const hasPaymentAmount =
                rawPaymentAmount !== undefined &&
                rawPaymentAmount !== null;
            const paymentAmount = parseFiniteNumber(rawPaymentAmount);
            const storedPaymentLkr = parseFiniteNumber(
                booking[`${paymentPrefix}AmountLkr`]
            );
            const hasValidStoredPaymentLkr =
                storedPaymentLkr !== null &&
                storedPaymentLkr > 0;

            if (hasPaymentAmount) {
                if (paymentAmount === null || paymentAmount <= 0) {
                    return 0;
                }
                if (hasValidStoredPaymentLkr) {
                    return storedPaymentLkr;
                }

                const paymentCurrency = String(
                    booking[`${paymentPrefix}Currency`] ||
                    booking.currency ||
                    "AUD"
                ).toUpperCase();
                const paymentRate =
                    getValidExchangeRate(
                        paymentCurrency,
                        booking[`${paymentPrefix}ExchangeRateToLkr`]
                    ) ??
                    getValidExchangeRate(
                        paymentCurrency,
                        booking.exchangeRateToLkr
                    );
                const paymentEquivalent = getLkrEquivalent(
                    paymentAmount,
                    paymentCurrency,
                    paymentRate,
                    null
                );

                if (paymentEquivalent !== null) {
                    return paymentEquivalent;
                }
            }

            const rawLegacyAmount = booking[legacyAmountField];
            const hasLegacyAmount =
                rawLegacyAmount !== undefined &&
                rawLegacyAmount !== null;
            const legacyAmount = parseFiniteNumber(rawLegacyAmount);
            const legacyStoredLkr = parseFiniteNumber(
                booking[legacyAmountLkrField]
            );
            const hasValidLegacyStoredLkr =
                legacyStoredLkr !== null &&
                legacyStoredLkr > 0;

            if (hasLegacyAmount) {
                if (legacyAmount === null || legacyAmount <= 0) {
                    return 0;
                }
                if (hasValidLegacyStoredLkr) {
                    return legacyStoredLkr;
                }

                return getLkrEquivalent(
                    legacyAmount,
                    booking.currency || "AUD",
                    booking.exchangeRateToLkr,
                    null
                ) ?? 0;
            }

            if (hasValidStoredPaymentLkr) {
                return storedPaymentLkr;
            }

            return hasValidLegacyStoredLkr
                ? legacyStoredLkr
                : 0;
        };

        const getBookingTotalLkr = booking => {
            const storedTotalLkr = parseFiniteNumber(booking.totalLkr);
            if (storedTotalLkr !== null && storedTotalLkr > 0) {
                return storedTotalLkr;
            }

            const originalTotal = parseFiniteNumber(booking.total);
            if (originalTotal === null || originalTotal <= 0) {
                return 0;
            }

            return getLkrEquivalent(
                originalTotal,
                booking.currency || "AUD",
                booking.exchangeRateToLkr,
                null
            ) ?? 0;
        };

        const hasPaymentStatus = (booking, type) =>
            booking[`${type}PaymentStatus`] !== undefined &&
            booking[`${type}PaymentStatus`] !== null;

        const isDepositPaid = booking => {
            const hasStatus = hasPaymentStatus(booking, "deposit");
            const legacyStatus = String(booking.paymentStatus || "");

            return hasStatus
                ? booking.depositPaymentStatus === "Paid"
                : (
                    booking.depositPaid === true ||
                    legacyStatus === "Deposit Paid" ||
                    legacyStatus === "Balance Due" ||
                    legacyStatus === "Paid"
                );
        };

        const isBalancePaid = booking => {
            const hasStatus = hasPaymentStatus(booking, "balance");
            const legacyStatus = String(booking.paymentStatus || "");

            return hasStatus
                ? booking.balancePaymentStatus === "Paid"
                : (
                    booking.balancePaid === true ||
                    legacyStatus === "Paid"
                );
        };

        const bookingOutstandingLkr = booking => {
            const totalLkr = getBookingTotalLkr(booking);
            const depositLkr = isDepositPaid(booking)
                ? getPaymentAmountLkr(
                    booking,
                    "deposit",
                    "depositAmount",
                    "depositAmountLkr"
                )
                : 0;
            const balanceLkr = isBalancePaid(booking)
                ? getPaymentAmountLkr(
                    booking,
                    "balance",
                    "balanceAmount",
                    "balanceAmountLkr"
                )
                : 0;
            const remaining = totalLkr - depositLkr - balanceLkr;

            return Number.isFinite(remaining)
                ? Math.max(0, remaining)
                : 0;
        };

        bookings.forEach(
            booking => {
                outstanding = addFiniteNumbers(
                    outstanding,
                    bookingOutstandingLkr(booking)
                );
            }
        );

        const paymentDateIsInPeriod = value => {
            if (!value || !period) {
                return false;
            }

            const paymentDate = parseDate(value);

            return Boolean(
                paymentDate &&
                paymentDate >= period.from &&
                paymentDate <= period.to
            );
        };

        (Array.isArray(receiptBookings) ? receiptBookings : [])
            .forEach(booking => {
                const depositPaid = isDepositPaid(booking);
                const balancePaid = isBalancePaid(booking);
                const hasDepositStatus = hasPaymentStatus(booking, "deposit");
                const hasBalanceStatus = hasPaymentStatus(booking, "balance");
                const depositDate = hasDepositStatus
                    ? booking.depositPaymentDate
                    : booking.paymentReceivedDate;
                const balanceDate = hasBalanceStatus
                    ? booking.balancePaymentDate
                    : booking.paymentReceivedDate;

                if (
                    depositPaid &&
                    paymentDateIsInPeriod(depositDate)
                ) {
                    depositsReceived = addFiniteNumbers(
                        depositsReceived,
                        getPaymentAmountLkr(
                            booking,
                            "deposit",
                            "depositAmount",
                            "depositAmountLkr"
                        )
                    );
                }

                if (
                    balancePaid &&
                    paymentDateIsInPeriod(balanceDate)
                ) {
                    balancesReceived = addFiniteNumbers(
                        balancesReceived,
                        getPaymentAmountLkr(
                            booking,
                            "balance",
                            "balanceAmount",
                            "balanceAmountLkr"
                        )
                    );
                }
            });
        return {
            depositsReceived,
            balancesReceived,
            totalReceived: addFiniteNumbers(
                depositsReceived,
                balancesReceived
            ),
            outstanding
        };
    }

    function calculateRevenueByGuestCount(
        bookings,
        period
    ) {
        const groups = {};

        for (
            let guestCount = 1;
            guestCount <= 9;
            guestCount += 1
        ) {
            groups[guestCount] = {
                guestCount,
                bookings: 0,
                bookedNights: 0,
                guestNights: 0,
                revenue: 0
            };
        }

        bookings.forEach(
            booking => {
                const guests =
                    getGuestCount(
                        booking
                    );

                if (
                    guests === null ||
                    guests < 1 ||
                    guests > 9
                ) {
                    return;
                }

                const checkin =
                    parseDate(
                        booking.checkin
                    );

                const checkout =
                    parseDate(
                        booking.checkout
                    );

                const overlapNights =
                    calculateOverlapNights(
                        checkin,
                        checkout,
                        period
                    );

                if (
                    overlapNights <= 0
                ) {
                    return;
                }

                const bookingNights =
                    getBookingNights(
                        booking,
                        checkin,
                        checkout
                    );

                if (
                    bookingNights <= 0
                ) {
                    return;
                }

                const revenue =
                    getPeriodRevenue(
                        booking,
                        period,
                        overlapNights,
                        bookingNights
                    );

                groups[guests].bookings = addFiniteNumbers(
                    groups[guests].bookings,
                    1
                );

                groups[guests].bookedNights = addFiniteNumbers(
                    groups[guests].bookedNights,
                    overlapNights
                );

                groups[guests].guestNights = addFiniteNumbers(
                    groups[guests].guestNights,
                    multiplyFiniteNumbers(guests, overlapNights) ?? 0
                );

                groups[guests].revenue = addFiniteNumbers(
                    groups[guests].revenue,
                    revenue.total
                );
            }
        );

        return Object.values(
            groups
        );
    }

    function calculateDashboard(
        period
    ) {
        const bookings =
            getConfirmedBookings(
                period
            );

        const income =
            calculateIncome(
                bookings,
                period
            );

        const expenses =
            calculateExpenses(
                period
            );

        const netProfitValue =
            income.total -
            expenses.total;
        const netProfit = Number.isFinite(netProfitValue)
            ? netProfitValue
            : 0;

        const availableNights =
            daysBetween(
                period.from,
                periodEndExclusive(
                    period
                )
            );

        const occupancyRate = multiplyFiniteNumbers(
            divideFiniteNumbers(income.bookedNights, availableNights),
            100
        ) ?? 0;

        const profitMargin = multiplyFiniteNumbers(
            divideFiniteNumbers(netProfit, income.total),
            100
        ) ?? 0;

        const revenuePerNight = divideFiniteNumbers(
            income.total,
            income.bookedNights
        );

        const expensePerNight = divideFiniteNumbers(
            expenses.total,
            income.bookedNights
        );

        const profitPerNight = divideFiniteNumbers(
            netProfit,
            income.bookedNights
        );

        const payments =
            calculatePayments(
                bookings,
                period,
                state.bookings || []
            );

        const averageGuestsPerBooking = divideFiniteNumbers(
            income.totalGuests,
            income.guestDataBookings
        );

        const revenuePerGuest = divideFiniteNumbers(
            income.total,
            income.totalGuests
        );

        const revenuePerGuestNight = divideFiniteNumbers(
            income.total,
            income.guestNights
        );

        const averageBookingValue = divideFiniteNumbers(
            income.total,
            bookings.length
        );

        const averageStay = divideFiniteNumbers(
            income.totalStayNights,
            bookings.length
        );

        const revenueByGuestCount =
            calculateRevenueByGuestCount(
                bookings,
                period
            );

        const dashboardBookings = bookings.map(
            booking => Object.fromEntries(
                Object.entries(booking).map(
                    ([key, value]) => [
                        key,
                        typeof value === "number" && !Number.isFinite(value)
                            ? null
                            : value
                    ]
                )
            )
        );

        return {
            period,
            bookings: dashboardBookings,
            income,
            expenses,
            netProfit,
            availableNights,
            occupancyRate,
            profitMargin,
            revenuePerNight,
            expensePerNight,
            profitPerNight,
            payments,
            revenueByGuestCount,
            guestAnalysis: {
                totalBookings:
                    bookings.length,

                totalGuests:
                    income.totalGuests,

                averageGuestsPerBooking,

                guestNights:
                    income.guestNights,

                revenuePerGuest,

                revenuePerGuestNight,

                averageBookingValue,

                averageStay,

                guestDataBookings:
                    income.guestDataBookings
            }
        };
    }

    function setText(
        id,
        value
    ) {
        const element =
            document.getElementById(
                id
            );

        if (element) {
            element.textContent =
                value;
        }
    }

    function renderRevenueByGuestCount(
        rows
    ) {
        const body =
            document.getElementById(
                "revenueByGuestBody"
            );

        if (!body) {
            return;
        }

        const activeRows =
            rows.filter(
                row =>
                    row.bookings > 0
            );

        if (
            activeRows.length === 0
        ) {
            body.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="empty-row">
                        No confirmed bookings with
                        guest data were found for
                        this period.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML =
            activeRows.map(
                row => {
                    const revenuePerNight =
                        row.bookedNights > 0
                            ? row.revenue /
                              row.bookedNights
                            : 0;

                    const revenuePerGuestNight =
                        row.guestNights > 0
                            ? row.revenue /
                              row.guestNights
                            : 0;

                    return `
                        <tr>
                            <td>
                                ${number(
                                    row.guestCount
                                )}
                            </td>

                            <td>
                                ${number(
                                    row.bookings
                                )}
                            </td>

                            <td>
                                ${number(
                                    row.bookedNights
                                )}
                            </td>

                            <td>
                                ${number(
                                    row.guestNights
                                )}
                            </td>

                            <td>
                                ${money(
                                    row.revenue
                                )}
                            </td>

                            <td>
                                ${money(
                                    revenuePerNight
                                )}
                            </td>

                            <td>
                                ${money(
                                    revenuePerGuestNight
                                )}
                            </td>
                        </tr>
                    `;
                }
            ).join("");
    }

    function renderDashboard(
        result
    ) {
        setText(
            "periodSummary",
            `Reporting period: ${formatDate(
                result.period.from
            )} to ${formatDate(
                result.period.to
            )}`
        );

        setText(
            "kpiRevenue",
            money(
                result.income.total
            )
        );

        setText(
            "kpiExpenses",
            money(
                result.expenses.total
            )
        );

        let conversionWarning = document.getElementById("expenseConversionWarning");
        if (!conversionWarning) {
            conversionWarning = document.createElement("div");
            conversionWarning.id = "expenseConversionWarning";
            conversionWarning.setAttribute("role", "status");
            const expenseKpi = document.getElementById("kpiExpenses");
            if (expenseKpi?.parentElement) {
                expenseKpi.parentElement.appendChild(conversionWarning);
            }
        }
        conversionWarning.textContent = result.expenses.missingConversions > 0
            ? `${result.expenses.missingConversions} active expense or utility record(s) excluded: missing a valid historical AUD-to-LKR conversion.`
            : "";

        setText(
            "kpiProfit",
            money(
                result.netProfit
            )
        );

        setText(
            "kpiOccupancy",
            percentage(
                result.occupancyRate
            )
        );

        setText(
            "kpiBookedNights",
            number(
                result.income.bookedNights
            )
        );

        setText(
            "kpiMargin",
            percentage(
                result.profitMargin
            )
        );

        setText(
            "incomeAccommodation",
            money(
                result.income.accommodation
            )
        );

        setText(
            "incomeExtraGuest",
            money(
                result.income.extraGuestFee
            )
        );

        setText(
            "incomeCleaning",
            money(
                result.income.cleaningFee
            )
        );

        setText(
            "incomeOther",
            money(
                result.income.otherIncome
            )
        );

        setText(
            "incomeTotal",
            money(
                result.income.total
            )
        );

        setText(
            "expenseBookingSpecific",
            money(
                result.expenses
                    .bookingSpecific
            )
        );

        setText(
            "expenseVariable",
            money(
                result.expenses
                    .variableProperty
            )
        );

        setText(
            "expenseFixed",
            money(
                result.expenses
                    .fixedProperty
            )
        );

        setText(
            "expenseOther",
            money(
                result.expenses.other
            )
        );

        setText(
            "expenseUtilities",
            money(
                result.expenses.utilities
            )
        );

        setText(
            "expenseTotal",
            money(
                result.expenses.total
            )
        );
        setText(
            "availableNights",
            number(
                result.availableNights
            )
        );

        setText(
            "analysisBookedNights",
            number(
                result.income.bookedNights
            )
        );

        setText(
            "revenuePerNight",
            money(
                result.revenuePerNight
            )
        );

        setText(
            "expensePerNight",
            money(
                result.expensePerNight
            )
        );

        setText(
            "profitPerNight",
            money(
                result.profitPerNight
            )
        );

        setText(
            "analysisProfitMargin",
            percentage(
                result.profitMargin
            )
        );

        setText(
            "totalBookings",
            number(
                result.guestAnalysis
                    .totalBookings
            )
        );

        setText(
            "totalGuests",
            number(
                result.guestAnalysis
                    .totalGuests
            )
        );

        setText(
            "averageGuestsPerBooking",
            decimal(
                result.guestAnalysis
                    .averageGuestsPerBooking
            )
        );

        setText(
            "guestNights",
            number(
                result.guestAnalysis
                    .guestNights
            )
        );

        setText(
            "revenuePerGuest",
            money(
                result.guestAnalysis
                    .revenuePerGuest
            )
        );

        setText(
            "revenuePerGuestNight",
            money(
                result.guestAnalysis
                    .revenuePerGuestNight
            )
        );

        setText(
            "averageBookingValue",
            money(
                result.guestAnalysis
                    .averageBookingValue
            )
        );

        setText(
            "averageStay",
            `${decimal(
                result.guestAnalysis
                    .averageStay
            )} nights`
        );

        setText(
            "paymentsDeposits",
            money(
                result.payments
                    .depositsReceived
            )
        );

        setText(
            "paymentsBalances",
            money(
                result.payments
                    .balancesReceived
            )
        );

        setText(
            "paymentsReceived",
            money(
                result.payments
                    .totalReceived
            )
        );

        setText(
            "paymentsOutstanding",
            money(
                result.payments
                    .outstanding
            )
        );

        renderRevenueByGuestCount(
            result.revenueByGuestCount
        );
    }

    function showError(
        message
    ) {
        const element =
            document.getElementById(
                "dashboardError"
            );

        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.style.display =
            "block";
    }

    function clearError() {
        const element =
            document.getElementById(
                "dashboardError"
            );

        if (!element) {
            return;
        }

        element.textContent = "";

        element.style.display =
            "none";
    }

    async function loadDashboard() {
        clearError();

        try {
            const period =
                getPeriod();

            const [
                bookingsSnapshot,
                expensesSnapshot,
                utilitySnapshot
            ] = await Promise.all([
                db
                    .collection(
                        bookingsCollection
                    )
                    .get(),

                db
                    .collection(
                        expensesCollection
                    )
                    .get(),

                db
                    .collection(
                        utilityBillsCollection
                    )
                    .get()
            ]);

            state.bookings =
                bookingsSnapshot.docs.map(
                    doc => ({
                        id: doc.id,
                        ...doc.data()
                    })
                );

            state.expenses =
                expensesSnapshot.docs.map(
                    doc => ({
                        id: doc.id,
                        ...doc.data()
                    })
                );

            state.utilityBills =
                utilitySnapshot.docs.map(
                    doc => ({
                        id: doc.id,
                        ...doc.data()
                    })
                );

            const result =
                calculateDashboard(
                    period
                );

            renderDashboard(
                result
            );

            console.log(
                "ACCT-001 Dashboard calculated:",
                result
            );
        } catch (error) {
            console.error(
                "ACCT-001 Dashboard load failed:",
                error
            );

            showError(
                error.message ||
                "Unable to load Accounts Dashboard."
            );
        }
    }

    function toggleCustomRange() {
        const selector =
            document.getElementById(
                "periodSelector"
            );

        const customFrom =
            document.getElementById(
                "customFromField"
            );

        const customTo =
            document.getElementById(
                "customToField"
            );

        const isCustom =
            selector &&
            selector.value ===
                "custom";

        if (customFrom) {
            customFrom.hidden =
                !isCustom;
        }

        if (customTo) {
            customTo.hidden =
                !isCustom;
        }
    }

    document.addEventListener(
        "DOMContentLoaded",
        () => {
            const selector =
                document.getElementById(
                    "periodSelector"
                );

            const refresh =
                document.getElementById(
                    "refreshDashboard"
                );

            if (selector) {
                selector.addEventListener(
                    "change",
                    () => {
                        toggleCustomRange();

                        if (
                            selector.value !==
                            "custom"
                        ) {
                            loadDashboard();
                        }
                    }
                );
            }

            if (refresh) {
                refresh.addEventListener(
                    "click",
                    loadDashboard
                );
            }

            toggleCustomRange();

            loadDashboard();
        }
    );
})();
