(function () {
    "use strict";

    const PAYMENT_TYPES = Object.freeze([
        "Deposit",
        "Balance",
        "Full Payment",
        "Refund"
    ]);

    const PAYMENT_STATUSES = Object.freeze([
        "Pending",
        "Completed",
        "Failed",
        "Cancelled",
        "Refunded"
    ]);

    const PAYMENT_METHODS = Object.freeze([
        "Stripe",
        "Bank Transfer",
        "Cash",
        "Credit/Debit Card",
        "Other"
    ]);

    const normaliseNumber = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    };

    const normaliseText = (value) => {
        return String(value ?? "").trim();
    };

    const isValidPaymentType = (value) => {
        return PAYMENT_TYPES.includes(value);
    };

    const isValidPaymentStatus = (value) => {
        return PAYMENT_STATUSES.includes(value);
    };

    const isValidPaymentMethod = (value) => {
        return PAYMENT_METHODS.includes(value);
    };

    const validatePayment = (payment) => {
        const errors = [];

        if (!payment || typeof payment !== "object") {
            errors.push("Payment data is required.");
            return {
                valid: false,
                errors
            };
        }

        if (!normaliseText(payment.bookingId)) {
            errors.push("Booking is required.");
        }

        if (!normaliseText(payment.paymentDate)) {
            errors.push("Payment date is required.");
        }

        if (!isValidPaymentType(payment.paymentType)) {
            errors.push("A valid payment type is required.");
        }

        const amount = normaliseNumber(payment.amount);

        if (amount === 0) {
            errors.push("Payment amount cannot be zero.");
        }

        if (
            payment.paymentType !== "Refund" &&
            amount < 0
        ) {
            errors.push("Non-refund payment amount cannot be negative.");
        }

        if (
            payment.paymentType === "Refund" &&
            amount >= 0
        ) {
            errors.push("Refund amount must be negative.");
        }

        if (!normaliseText(payment.currency)) {
            errors.push("Currency is required.");
        }

        if (!isValidPaymentMethod(payment.paymentMethod)) {
            errors.push("A valid payment method is required.");
        }

        if (!isValidPaymentStatus(payment.paymentStatus)) {
            errors.push("A valid payment status is required.");
        }

        return {
            valid: errors.length === 0,
            errors
        };
    };

    const getCompletedPaymentAmount = (payments) => {
        if (!Array.isArray(payments)) {
            return 0;
        }

        return payments
            .filter(payment =>
                payment.paymentStatus === "Completed"
            )
            .reduce(
                (sum, payment) =>
                    sum + normaliseNumber(payment.amount),
                0
            );
    };

    const getRefundAmount = (payments) => {
        if (!Array.isArray(payments)) {
            return 0;
        }

        return Math.abs(
            payments
                .filter(payment =>
                    payment.paymentType === "Refund" &&
                    payment.paymentStatus === "Completed"
                )
                .reduce(
                    (sum, payment) =>
                        sum + normaliseNumber(payment.amount),
                    0
                )
        );
    };

    const getNetReceived = (payments) => {
        if (!Array.isArray(payments)) {
            return 0;
        }

        return payments
            .filter(payment =>
                payment.paymentStatus === "Completed"
            )
            .reduce(
                (sum, payment) =>
                    sum + normaliseNumber(payment.amount),
                0
            );
    };

    const getBookingOutstanding = (
        bookingTotal,
        payments
    ) => {
        const total = Math.max(
            0,
            normaliseNumber(bookingTotal)
        );

        const netReceived =
            getNetReceived(payments);

        return Math.max(
            0,
            total - netReceived
        );
    };

    const getBookingPaymentStatus = (
        bookingTotal,
        payments
    ) => {
        const total = Math.max(
            0,
            normaliseNumber(bookingTotal)
        );

        const completedPayments = Array.isArray(payments)
            ? payments.filter(payment =>
                payment.paymentStatus === "Completed"
            )
            : [];

        const netReceived = completedPayments.reduce(
            (sum, payment) =>
                sum + normaliseNumber(payment.amount),
            0
        );

        const depositReceived = completedPayments
            .filter(payment =>
                payment.paymentType === "Deposit"
            )
            .reduce(
                (sum, payment) =>
                    sum + normaliseNumber(payment.amount),
                0
            );

        if (total > 0 && netReceived >= total) {
            return "Paid";
        }

        if (depositReceived > 0) {
            return "Balance Due";
        }

        return "Deposit Required";
    };

    const isDuplicateTransactionReference = (
        payments,
        transactionReference,
        excludePaymentId = null
    ) => {
        const reference =
            normaliseText(transactionReference);

        if (!reference || !Array.isArray(payments)) {
            return false;
        }

        return payments.some(payment =>
            payment.id !== excludePaymentId &&
            normaliseText(payment.transactionReference) === reference &&
            payment.paymentStatus === "Completed"
        );
    };

    window.AccountsPaymentsUtils = Object.freeze({
        PAYMENT_TYPES,
        PAYMENT_STATUSES,
        PAYMENT_METHODS,

        normaliseNumber,
        normaliseText,

        isValidPaymentType,
        isValidPaymentStatus,
        isValidPaymentMethod,

        validatePayment,

        getCompletedPaymentAmount,
        getRefundAmount,
        getNetReceived,
        getBookingOutstanding,
        getBookingPaymentStatus,

        isDuplicateTransactionReference
    });
})();
