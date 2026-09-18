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

    function money(value) {
        return new Intl.NumberFormat(
            "en-AU",
            {
                style: "currency",
                currency: "AUD"
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
            Number(
                booking.adults
            ) || 0;

        const children =
            Number(
                booking.children
            ) || 0;

        const total =
            adults +
            children;

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
        const accommodation =
            Number(
                booking.accommodation
            ) || 0;

        const extraGuestFee =
            Number(
                booking.extraGuestFee
            ) || 0;

        const accommodationShare =
            bookingNights > 0
                ? accommodation *
                    (
                        overlapNights /
                        bookingNights
                    )
                : 0;

        const extraGuestShare =
            bookingNights > 0
                ? extraGuestFee *
                    (
                        overlapNights /
                        bookingNights
                    )
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
            cleaningFee =
                Number(
                    booking.cleaningFee
                ) || 0;
        }

        return {
            accommodation:
                accommodationShare,

            extraGuestFee:
                extraGuestShare,

            cleaningFee,

            total:
                accommodationShare +
                extraGuestShare +
                cleaningFee
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

                bookedNights +=
                    overlapNights;

                totalStayNights +=
                    bookingNights;

                const revenue =
                    getPeriodRevenue(
                        booking,
                        period,
                        overlapNights,
                        bookingNights
                    );

                accommodation +=
                    revenue.accommodation;

                extraGuestFee +=
                    revenue.extraGuestFee;

                cleaningFee +=
                    revenue.cleaningFee;

                const guests =
                    getGuestCount(
                        booking
                    );

                if (
                    guests !== null
                ) {
                    guestDataBookings +=
                        1;

                    totalGuests +=
                        guests;

                    guestNights +=
                        guests *
                        overlapNights;
                }
            }
        );

        const total =
            accommodation +
            extraGuestFee +
            cleaningFee +
            otherIncome;

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
            utilities: 0
        };

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
                        expense.date
                    );

                if (
                    !date ||
                    date < period.from ||
                    date > period.to
                ) {
                    return;
                }

                const amount =
                    Number(
                        expense.amount
                    ) || 0;

                const type =
                    String(
                        expense.expenseType ||
                        ""
                    ).toLowerCase();

                if (
                    type ===
                    "booking-specific"
                ) {
                    result.bookingSpecific +=
                        amount;
                } else if (
                    type ===
                    "variable property"
                ) {
                    result.variableProperty +=
                        amount;
                } else if (
                    type ===
                    "fixed property"
                ) {
                    result.fixedProperty +=
                        amount;
                } else {
                    result.other +=
                        amount;
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

                result.utilities +=
                    Number(
                        bill.amount
                    ) || 0;
            }
        );

        result.total =
            result.bookingSpecific +
            result.variableProperty +
            result.fixedProperty +
            result.other +
            result.utilities;

        return result;
    }

    function calculatePayments(
        bookings
    ) {
        let depositsReceived = 0;
        let balancesReceived = 0;
        let outstanding = 0;

        bookings.forEach(
            booking => {
                depositsReceived +=
                    Number(
                        booking.depositPaid
                    ) || 0;

                balancesReceived +=
                    Number(
                        booking.balancePaid
                    ) || 0;

                outstanding +=
                    Number(
                        booking.balanceAmount
                    ) || 0;
            }
        );

        return {
            depositsReceived,
            balancesReceived,
            totalReceived:
                depositsReceived +
                balancesReceived,
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

                groups[guests].bookings +=
                    1;

                groups[guests].bookedNights +=
                    overlapNights;

                groups[guests].guestNights +=
                    guests *
                    overlapNights;

                groups[guests].revenue +=
                    revenue.total;
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

        const netProfit =
            income.total -
            expenses.total;

        const availableNights =
            daysBetween(
                period.from,
                periodEndExclusive(
                    period
                )
            );

        const occupancyRate =
            availableNights > 0
                ? (
                    income.bookedNights /
                    availableNights
                ) * 100
                : 0;

        const profitMargin =
            income.total > 0
                ? (
                    netProfit /
                    income.total
                ) * 100
                : 0;

        const revenuePerNight =
            income.bookedNights > 0
                ? income.total /
                  income.bookedNights
                : 0;

        const expensePerNight =
            income.bookedNights > 0
                ? expenses.total /
                  income.bookedNights
                : 0;

        const profitPerNight =
            income.bookedNights > 0
                ? netProfit /
                  income.bookedNights
                : 0;

        const payments =
            calculatePayments(
                bookings
            );

        const averageGuestsPerBooking =
            income.guestDataBookings > 0
                ? income.totalGuests /
                  income.guestDataBookings
                : 0;

        const revenuePerGuest =
            income.totalGuests > 0
                ? income.total /
                  income.totalGuests
                : 0;

        const revenuePerGuestNight =
            income.guestNights > 0
                ? income.total /
                  income.guestNights
                : 0;

        const averageBookingValue =
            bookings.length > 0
                ? income.total /
                  bookings.length
                : 0;

        const averageStay =
            bookings.length > 0
                ? income.totalStayNights /
                  bookings.length
                : 0;

        const revenueByGuestCount =
            calculateRevenueByGuestCount(
                bookings,
                period
            );

        return {
            period,
            bookings,
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
