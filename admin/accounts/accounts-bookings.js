(function () {
    "use strict";

    let db = null;
    let allBookings = [];

    const money = (value) => {
        const amount = Number(value) || 0;
        return `AUD $${amount.toFixed(2)}`;
    };

    const number = (value) => Number(value) || 0;

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
        if (
            booking.paymentStatus === "Paid" ||
            booking.balancePaymentStatus === "Paid" ||
            booking.balancePaid === true
        ) {
            return "Paid";
        }

        if (
            booking.balancePaymentStatus === "Balance Due"
        ) {
            return "Balance Due";
        }

        if (
            booking.paymentStatus === "Deposit Paid"
        ) {
            return "Deposit Paid";
        }

        if (
            booking.paymentStatus === "Deposit Required" ||
            booking.paymentStatus === "Deposit Checkout Created"
        ) {
            return "Deposit Required";
        }

        return booking.paymentStatus || "Pending";
    };

    const getDepositPaid = (booking) => {
        if (booking.depositPaid === true) {
            return number(booking.depositAmount);
        }

        return 0;
    };

    const getBalancePaid = (booking) => {
        if (
            booking.balancePaid === true ||
            booking.balancePaymentStatus === "Paid"
        ) {
            return number(booking.balanceAmount);
        }

        return 0;
    };

    const getOutstanding = (booking) => {
        const total = number(booking.total);
        const depositPaid = getDepositPaid(booking);
        const balancePaid = getBalancePaid(booking);

        return Math.max(
            0,
            total - depositPaid - balancePaid
        );
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

        if (from && checkout) {
            return checkout > from && checkin <= to;
        }

        if (from) {
            return checkin >= from;
        }

        return checkin <= to;
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
                        sum + number(booking.total),
                    0
                );
        const deposits =
            bookings.reduce(
                (sum, booking) =>
                    sum + getDepositPaid(booking),
                0
            );

        const balances =
            bookings.reduce(
                (sum, booking) =>
                    sum + getBalancePaid(booking),
                0
            );

        const outstanding =
            bookings.reduce(
                (sum, booking) =>
                    sum + getOutstanding(booking),
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
        ).textContent = money(revenue);

        document.getElementById(
            "summaryDeposits"
        ).textContent = money(deposits);

        document.getElementById(
            "summaryBalances"
        ).textContent = money(balances);

        document.getElementById(
            "summaryOutstanding"
        ).textContent = money(outstanding);
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
                    ${money(booking.total)}
                </td>

                <td class="numeric">
                    ${money(deposit)}
                </td>

                <td class="numeric">
                    ${money(balance)}
                </td>

                <td class="numeric">
                    ${money(outstanding)}
                </td>

                <td>
                    <button
                        class="btn-secondary"
                        data-booking-id="${escapeHtml(booking.id)}">
                        View
                    </button>
                </td>
            `;

            row.querySelector("button")
                .addEventListener(
                    "click",
                    () => showDetail(booking)
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
            money(booking.accommodation);

        document.getElementById(
            "detailExtraGuest"
        ).textContent =
            money(booking.extraGuestFee);

        document.getElementById(
            "detailCleaning"
        ).textContent =
            money(booking.cleaningFee);

        document.getElementById(
            "detailTotal"
        ).textContent =
            money(booking.total);

        document.getElementById(
            "detailDeposit"
        ).textContent =
            money(booking.depositAmount);

        document.getElementById(
            "detailDepositPaid"
        ).textContent =
            money(getDepositPaid(booking));

        document.getElementById(
            "detailBalance"
        ).textContent =
            money(booking.balanceAmount);

        document.getElementById(
            "detailBalancePaid"
        ).textContent =
            money(getBalancePaid(booking));

        document.getElementById(
            "detailOutstanding"
        ).textContent =
            money(getOutstanding(booking));

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

})();
