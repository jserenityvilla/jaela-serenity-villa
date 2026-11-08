(function (global) {
    "use strict";

    const CONFIRMED = "Confirmed";
    const ACTIVE = "Active";

    function number(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function parseDate(value) {
        if (!value) {
            return null;
        }

        const date = new Date(`${value}T00:00:00`);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    function startOfDay(date) {
        return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    function maxDate(a, b) {
        return a > b ? a : b;
    }

    function minDate(a, b) {
        return a < b ? a : b;
    }

    function overlapDays(startA, endAExclusive, startB, endBExclusive) {
        const start = maxDate(startA, startB);
        const end = minDate(endAExclusive, endBExclusive);

        if (end <= start) {
            return 0;
        }

        return Math.round(
            (end.getTime() - start.getTime()) /
            86400000
        );
    }

    function bookingOverlapNights(booking, periodFrom, periodTo) {
        const checkIn = parseDate(booking.checkin);
        const checkOut = parseDate(booking.checkout);

        if (!checkIn || !checkOut) {
            return 0;
        }

        const periodStart = startOfDay(periodFrom);
        const periodEndExclusive = addDays(
            startOfDay(periodTo),
            1
        );

        return overlapDays(
            checkIn,
            checkOut,
            periodStart,
            periodEndExclusive
        );
    }

    function totalGuests(booking) {
        return (
            number(booking.totalGuests) ||
            number(booking.adults) + number(booking.children)
        );
    }

    function getBookingLkrAmount(booking, field) {
        const currency = String(booking.currency || "AUD").trim().toUpperCase();
        const amount = number(booking[field]);

        if (currency === "LKR" || amount === 0) {
            return amount;
        }

        const exchangeRate = Number(booking.exchangeRateToLkr);

        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
            const reference = booking.bookingReference || booking.id || "unknown";
            throw new Error(
                `Booking ${reference} is in ${currency} but has no valid exchange rate to LKR.`
            );
        }

        return Number((amount * exchangeRate).toFixed(2));
    }

    function getRecordLkrAmount(record, recordType) {
        const currency = String(record.currency || "AUD").trim().toUpperCase();
        const amount = number(record.amount);

        if (currency === "LKR" || amount === 0) {
            return amount;
        }

        const storedAmountLkr = Number(record.amountLkr);
        if (
            record.amountLkr !== null &&
            record.amountLkr !== undefined &&
            record.amountLkr !== "" &&
            Number.isFinite(storedAmountLkr) &&
            storedAmountLkr >= 0
        ) {
            return storedAmountLkr;
        }

        const exchangeRate = Number(record.exchangeRateToLkr);
        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
            const reference = record.reference || record.id || "unknown";
            throw new Error(
                `${recordType} ${reference} is in ${currency} but has no stored LKR amount or valid exchange rate. Update the record before running the report.`
            );
        }

        return Number((amount * exchangeRate).toFixed(2));
    }

    function isDateWithinPeriod(value, periodFrom, periodTo) {
        const date = parseDate(value);
        if (!date) {
            return false;
        }

        return (
            date >= startOfDay(periodFrom) &&
            date <= startOfDay(periodTo)
        );
    }

    function bookingRevenue(booking, periodFrom, periodTo) {
        if ((booking.status || "") !== CONFIRMED) {
            return 0;
        }

        const checkOut = parseDate(booking.checkout);
        const periodStart = startOfDay(periodFrom);
        const periodEnd = startOfDay(periodTo);

        const totalNights = number(booking.nights);

        if (totalNights <= 0) {
            return 0;
        }

        const overlapNights =
            bookingOverlapNights(
                booking,
                periodFrom,
                periodTo
            );

        const nightlyAllocation = overlapNights > 0
            ? (
                getBookingLkrAmount(booking, "accommodation") +
                getBookingLkrAmount(booking, "extraGuestFee")
            ) * (overlapNights / totalNights)
            : 0;

        const cleaningRecognized =
            checkOut &&
            checkOut >= periodStart &&
            checkOut <= periodEnd
                ? getBookingLkrAmount(booking, "cleaningFee")
                : 0;

        return nightlyAllocation + cleaningRecognized;
    }

    function revenueBreakdown(bookings, periodFrom, periodTo) {
        let accommodation = 0;
        let extraGuestFee = 0;
        let cleaningFee = 0;

        bookings.forEach(booking => {
            if ((booking.status || "") !== CONFIRMED) {
                return;
            }

            const checkOut = parseDate(booking.checkout);
            const periodStart = startOfDay(periodFrom);
            const periodEnd = startOfDay(periodTo);

            const totalNights = number(booking.nights);

            if (totalNights <= 0) {
                return;
            }

            const overlapNights =
                bookingOverlapNights(
                    booking,
                    periodFrom,
                    periodTo
                );

            if (overlapNights > 0) {
                const allocation =
                    overlapNights / totalNights;

                accommodation +=
                    getBookingLkrAmount(booking, "accommodation") * allocation;

                extraGuestFee +=
                    getBookingLkrAmount(booking, "extraGuestFee") * allocation;
            }

            if (
                checkOut &&
                checkOut >= periodStart &&
                checkOut <= periodEnd
            ) {
                cleaningFee +=
                    getBookingLkrAmount(booking, "cleaningFee");
            }
        });

        return {
            accommodation,
            extraGuestFee,
            cleaningFee
        };
    }

    function periodCalendarNights(periodFrom, periodTo) {
        const start = startOfDay(periodFrom);
        const end = startOfDay(periodTo);

        if (end < start) {
            return 0;
        }

        return Math.round(
            (end.getTime() - start.getTime()) /
            86400000
        ) + 1;
    }

    function occupiedNights(bookings, periodFrom, periodTo) {
        const ranges = [];

        for (const booking of bookings) {
            if ((booking.status || "") !== CONFIRMED) {
                continue;
            }

            const checkIn = parseDate(booking.checkin);
            const checkOut = parseDate(booking.checkout);

            if (!checkIn || !checkOut) {
                continue;
            }

            const periodStart = startOfDay(periodFrom);
            const periodEndExclusive = addDays(
                startOfDay(periodTo),
                1
            );

            const start = maxDate(
                checkIn,
                periodStart
            );

            const end = minDate(
                checkOut,
                periodEndExclusive
            );

            if (end > start) {
                ranges.push({
                    start,
                    end
                });
            }
        }

        let total = 0;

        for (const range of ranges) {
            total += overlapDays(
                range.start,
                range.end,
                range.start,
                range.end
            );
        }

        return total;
    }

    function getExpensesInPeriod(expenses, periodFrom, periodTo) {
        return expenses.filter(expense =>
            (expense.status || ACTIVE) === ACTIVE &&
            isDateWithinPeriod(
                expense.expenseDate,
                periodFrom,
                periodTo
            )
        );
    }

    function expenseBreakdown(expenses, periodFrom, periodTo) {
        const totals = {};

        getExpensesInPeriod(expenses, periodFrom, periodTo)
            .forEach(expense => {
                const type = expense.expenseType || "Other";
                totals[type] = (totals[type] || 0) +
                    getRecordLkrAmount(expense, "Expense");
            });

        return totals;
    }

    function expenseTotal(expenses, periodFrom, periodTo) {
        return Object.values(
            expenseBreakdown(expenses, periodFrom, periodTo)
        ).reduce((sum, amount) => sum + amount, 0);
    }

    function utilityBreakdown(
        utilityBills,
        bookings,
        periodFrom,
        periodTo
    ) {
        const reportingStart = startOfDay(periodFrom);
        const reportingEnd = startOfDay(periodTo);
        const totals = {};

        function add(allocationMethod, amount) {
            totals[allocationMethod] =
                (totals[allocationMethod] || 0) + amount;
        }

        function calendarDayNumber(value) {
            return Date.UTC(
                value.getFullYear(),
                value.getMonth(),
                value.getDate()
            ) / 86400000;
        }

        utilityBills
            .filter(bill => (bill.status || ACTIVE) === ACTIVE)
            .forEach(bill => {
                const allocationMethod =
                    String(bill.allocationMethod || "None").trim();

                // Property-level utility: recognise across the billing period.
                if (allocationMethod === "None") {
                    const billingStart = parseDate(bill.billingPeriodFrom);
                    const billingEnd = parseDate(bill.billingPeriodTo);
                    const hasBillingPeriod =
                        Boolean(bill.billingPeriodFrom || bill.billingPeriodTo);

                    if (hasBillingPeriod) {
                        if (
                            !billingStart ||
                            !billingEnd ||
                            billingEnd < billingStart
                        ) {
                            return;
                        }

                        const allocationStart = maxDate(
                            billingStart,
                            reportingStart
                        );

                        const allocationEnd = minDate(
                            billingEnd,
                            reportingEnd
                        );

                        if (allocationEnd < allocationStart) {
                            return;
                        }

                        const billingDays =
                            calendarDayNumber(billingEnd) -
                            calendarDayNumber(billingStart) + 1;

                        const reportingDays =
                            calendarDayNumber(allocationEnd) -
                            calendarDayNumber(allocationStart) + 1;

                        if (billingDays > 0 && reportingDays > 0) {
                            add(
                                allocationMethod,
                                Number((
                                    getRecordLkrAmount(bill, "Utility bill") *
                                    reportingDays /
                                    billingDays
                                ).toFixed(2))
                            );
                        }

                        return;
                    }

                    // Backward compatibility for records without billing dates.
                    if (isDateWithinPeriod(
                        bill.billDate,
                        periodFrom,
                        periodTo
                    )) {
                        add(
                            allocationMethod,
                            getRecordLkrAmount(bill, "Utility bill")
                        );
                    }

                    return;
                }

                // Allocate a billing-period utility across occupied nights.
                if (allocationMethod === "Occupied Nights") {
                    const billingStart = parseDate(bill.billingPeriodFrom);
                    const billingEnd = parseDate(bill.billingPeriodTo);

                    if (
                        !billingStart ||
                        !billingEnd ||
                        billingEnd < billingStart
                    ) {
                        return;
                    }

                    const totalOccupiedNights = occupiedNights(
                        bookings,
                        billingStart,
                        billingEnd
                    );

                    if (totalOccupiedNights <= 0) {
                        return;
                    }

                    const allocationStart = maxDate(
                        billingStart,
                        reportingStart
                    );
                    const allocationEnd = minDate(
                        billingEnd,
                        reportingEnd
                    );

                    if (allocationEnd < allocationStart) {
                        return;
                    }

                    const reportingOccupiedNights = occupiedNights(
                        bookings,
                        allocationStart,
                        allocationEnd
                    );

                    if (reportingOccupiedNights > 0) {
                        add(
                            allocationMethod,
                            Number((
                                getRecordLkrAmount(bill, "Utility bill") *
                                reportingOccupiedNights /
                                totalOccupiedNights
                            ).toFixed(2))
                        );
                    }
                    return;
                }

                // Direct-booking utility/costs are recognised once,
                // in the reporting period containing the booking checkout.
                if (allocationMethod === "Direct Booking") {
                    const booking = bookings.find(item =>
                        item.id === bill.bookingId
                    );
                    const checkOut = booking
                        ? parseDate(booking.checkout)
                        : null;

                    if (
                        checkOut &&
                        checkOut >= reportingStart &&
                        checkOut <= reportingEnd
                    ) {
                        add(
                            allocationMethod,
                            getRecordLkrAmount(bill, "Utility bill")
                        );
                    }
                }
            });

        return totals;
    }

    function utilityTotal(
        utilityBills,
        bookings,
        periodFrom,
        periodTo
    ) {
        return Object.values(
            utilityBreakdown(
                utilityBills,
                bookings,
                periodFrom,
                periodTo
            )
        ).reduce((sum, amount) => sum + amount, 0);
    }

    function calculateProfitability({
        bookings = [],
        expenses = [],
        utilityBills = [],
        periodFrom,
        periodTo
    }) {
        if (!periodFrom || !periodTo) {
            throw new Error(
                "periodFrom and periodTo are required."
            );
        }

        const revenue = bookings.reduce(
            (sum, booking) =>
                sum +
                bookingRevenue(
                    booking,
                    periodFrom,
                    periodTo
                ),
            0
        );

        const expensesTotal =
            expenseTotal(expenses, periodFrom, periodTo);

        const utilitiesTotal =
            utilityTotal(utilityBills, bookings, periodFrom, periodTo);

        const netProfit =
            revenue -
            expensesTotal -
            utilitiesTotal;

        const bookedNights =
            occupiedNights(
                bookings,
                periodFrom,
                periodTo
            );

        const calendarNights =
            periodCalendarNights(
                periodFrom,
                periodTo
            );

        const occupancy =
            calendarNights > 0
                ? bookedNights / calendarNights
                : 0;

        const profitPerNight =
            bookedNights > 0
                ? netProfit / bookedNights
                : 0;

        const profitMargin =
            revenue > 0
                ? netProfit / revenue
                : 0;

        const confirmedBookings =
            bookings.filter(
                booking =>
                    booking.status === CONFIRMED &&
                    bookingOverlapNights(
                        booking,
                        periodFrom,
                        periodTo
                    ) > 0
            );

        const guestCount =
            confirmedBookings.reduce(
                (sum, booking) =>
                    sum + totalGuests(booking),
                0
            );

        const guestNights =
            confirmedBookings.reduce(
                (sum, booking) =>
                    sum +
                    totalGuests(booking) *
                    bookingOverlapNights(
                        booking,
                        periodFrom,
                        periodTo
                    ),
                0
            );

        return {
            revenue,
            expenses: expensesTotal,
            utilities: utilitiesTotal,
            netProfit,
            bookedNights,
            calendarNights,
            occupancy,
            profitPerNight,
            profitMargin,
            confirmedBookings:
                confirmedBookings.length,
            totalGuests: guestCount,
            guestNights,
            revenuePerGuest:
                guestCount > 0
                    ? revenue / guestCount
                    : 0,
            revenuePerGuestNight:
                guestNights > 0
                    ? revenue / guestNights
                    : 0
        };
    }

    function filterProfitabilityBookings(bookings = []) {
        return bookings.filter(
            booking =>
                booking &&
                booking.excludeFromProfitability !== true
        );
    }

    function filterProfitabilityExpenses(expenses = []) {
        return expenses.filter(
            expense =>
                expense &&
                expense.excludeFromProfitability !== true
        );
    }

    global.AccountsProfitabilityUtils = {
        bookingRevenue,
        revenueBreakdown,
        bookingOverlapNights,
        periodCalendarNights,
        occupiedNights,
        isDateWithinPeriod,
        getRecordLkrAmount,
        getExpensesInPeriod,
        expenseBreakdown,
        expenseTotal,
        utilityBreakdown,
        utilityTotal,
        calculateProfitability,
        filterProfitabilityBookings,
        filterProfitabilityExpenses,
    };

})(typeof window !== "undefined" ? window : globalThis);
