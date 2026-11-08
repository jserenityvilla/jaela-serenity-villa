"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const bookingSource = fs.readFileSync(
    path.join(__dirname, "..", "admin", "accounts", "accounts-bookings.js"),
    "utf8"
);

function extractBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, "Required source block was not found.");
    return source.slice(start, end).trim();
}

function extractFunction(source, name) {
    const match = source.match(
        new RegExp("function " + name + "\\([\\s\\S]*?\\n    }")
    );
    assert.ok(match, "Function " + name + " was not found.");
    return match[0].trim();
}

const overallStatusFunction = extractFunction(
    bookingSource,
    "calculateOverallPaymentStatus"
);

const actualPaymentHelpers = extractBetween(
    bookingSource,
    "const hasActualPaymentAmounts =",
    "const getGuestCount ="
);

const paymentStatusHelpers = extractBetween(
    bookingSource,
    "const getPaymentStatus =",
    "const parseDate ="
);

const parseFiniteNonNegativeNumber = value => {
    if (typeof value !== "number" && typeof value !== "string") {
        return null;
    }
    if (typeof value === "string" && value.trim() === "") {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const calculateLkrEquivalent = (amount, rate) => {
    const parsedAmount = parseFiniteNonNegativeNumber(amount);
    const parsedRate = parseFiniteNonNegativeNumber(rate);
    if (parsedAmount === null || parsedRate === null) return null;
    const result = parsedAmount * parsedRate;
    return Number.isFinite(result) && result >= 0 ? result : null;
};

const bookingHelpers = new Function(
    "number",
    overallStatusFunction + "\n" +
        actualPaymentHelpers + "\n" +
        paymentStatusHelpers + "\n" +
        "return { calculateOverallPaymentStatus, getPaymentStatus, getDepositPaidLkr, getBalancePaidLkr, getOutstandingLkr, getActualPaymentAmountLkr };"
)(
    value => Number(value) || 0
);

function makePartialLkrBooking(overrides = {}) {
    return {
        id: "JSV-TEST-ACTUAL-AMOUNTS",
        currency: "AUD",
        total: 120,
        totalLkr: 27000,
        exchangeRateToLkr: 225,
        depositAmount: 36,
        balanceAmount: 84,
        depositAmountLkr: 8100,
        balanceAmountLkr: 18900,
        paymentStatus: "Paid",
        depositPaid: true,
        balancePaid: true,
        depositPaymentStatus: "Paid",
        depositPaymentAmount: 5000,
        depositPaymentCurrency: "LKR",
        depositPaymentExchangeRateToLkr: 1,
        depositPaymentAmountLkr: 5000,
        balancePaymentStatus: "Paid",
        balancePaymentAmount: 10000,
        balancePaymentCurrency: "LKR",
        balancePaymentExchangeRateToLkr: 1,
        balancePaymentAmountLkr: 10000,
        ...overrides
    };
}

test("partial LKR deposit and balance receipts produce Balance Due", () => {
    const booking = makePartialLkrBooking();
    assert.equal(bookingHelpers.getDepositPaidLkr(booking), 5000);
    assert.equal(bookingHelpers.getBalancePaidLkr(booking), 10000);
    assert.equal(bookingHelpers.getOutstandingLkr(booking), 12000);
    assert.equal(bookingHelpers.getPaymentStatus(booking), "Balance Due");
});

test("fully received booking amount produces Paid", () => {
    const booking = makePartialLkrBooking({
        balancePaymentAmount: 22000,
        balancePaymentAmountLkr: 22000
    });
    assert.equal(bookingHelpers.getOutstandingLkr(booking), 0);
    assert.equal(bookingHelpers.getPaymentStatus(booking), "Paid");
});

test("deposit received without a balance receipt produces Deposit Paid", () => {
    const booking = makePartialLkrBooking({
        paymentStatus: "Deposit Paid",
        balancePaid: false,
        balancePaymentStatus: "Not Paid",
        balancePaymentAmount: 0,
        balancePaymentAmountLkr: 0
    });
    assert.equal(bookingHelpers.getOutstandingLkr(booking), 22000);
    assert.equal(bookingHelpers.getPaymentStatus(booking), "Deposit Paid");
});

test("no actual receipts produce Deposit Required", () => {
    const booking = makePartialLkrBooking({
        paymentStatus: "Deposit Required",
        depositPaid: false,
        balancePaid: false,
        depositPaymentStatus: "Not Paid",
        depositPaymentAmount: 0,
        depositPaymentAmountLkr: 0,
        balancePaymentStatus: "Not Paid",
        balancePaymentAmount: 0,
        balancePaymentAmountLkr: 0
    });
    assert.equal(bookingHelpers.getOutstandingLkr(booking), 27000);
    assert.equal(bookingHelpers.getPaymentStatus(booking), "Deposit Required");
});

test("partial balance receipt with an outstanding amount produces Balance Due", () => {
    const booking = makePartialLkrBooking({
        depositPaymentStatus: "Not Paid",
        depositPaymentAmount: 0,
        depositPaymentAmountLkr: 0,
        balancePaymentStatus: "Paid",
        balancePaymentAmount: 10000,
        balancePaymentAmountLkr: 10000
    });
    assert.equal(bookingHelpers.getPaymentStatus(booking), "Balance Due");
});

test("actual Not Paid fields override legacy scheduled-payment flags", () => {
    const booking = makePartialLkrBooking({
        depositPaid: true,
        balancePaid: true,
        depositPaymentStatus: "Not Paid",
        depositPaymentAmount: 0,
        depositPaymentAmountLkr: 0,
        balancePaymentStatus: "Not Paid",
        balancePaymentAmount: 0,
        balancePaymentAmountLkr: 0
    });
    assert.equal(bookingHelpers.getDepositPaidLkr(booking), 0);
    assert.equal(bookingHelpers.getBalancePaidLkr(booking), 0);
    assert.equal(bookingHelpers.getOutstandingLkr(booking), 27000);
    assert.equal(bookingHelpers.getPaymentStatus(booking), "Deposit Required");
});

test("legacy records without actual-amount fields retain stored payment status", () => {
    const legacy = {
        currency: "AUD",
        total: 120,
        totalLkr: 27000,
        exchangeRateToLkr: 225,
        depositAmountLkr: 8100,
        balanceAmountLkr: 18900,
        depositPaid: true,
        balancePaid: true,
        paymentStatus: "Paid"
    };
    assert.equal(bookingHelpers.getPaymentStatus(legacy), "Paid");
    assert.equal(bookingHelpers.getDepositPaidLkr(legacy), 8100);
    assert.equal(bookingHelpers.getBalancePaidLkr(legacy), 18900);
});

test("explicit Balance Due state is preserved while an amount remains outstanding", () => {
    const booking = makePartialLkrBooking({
        paymentStatus: "Deposit Paid",
        balancePaymentStatus: "Balance Due",
        balancePaymentAmount: 0,
        balancePaymentAmountLkr: 0
    });
    assert.equal(bookingHelpers.getPaymentStatus(booking), "Balance Due");
});

test("actual AUD and USD payment amounts convert using their saved rates", () => {
    const booking = makePartialLkrBooking({
        depositPaymentAmount: 100,
        depositPaymentCurrency: "AUD",
        depositPaymentExchangeRateToLkr: 225,
        depositPaymentAmountLkr: 22500,
        balancePaymentAmount: 10,
        balancePaymentCurrency: "USD",
        balancePaymentExchangeRateToLkr: 330,
        balancePaymentAmountLkr: 3300
    });
    assert.equal(
        bookingHelpers.getActualPaymentAmountLkr(booking, "deposit"),
        22500
    );
    assert.equal(
        bookingHelpers.getActualPaymentAmountLkr(booking, "balance"),
        3300
    );
    assert.equal(bookingHelpers.getOutstandingLkr(booking), 1200);
    assert.equal(bookingHelpers.getPaymentStatus(booking), "Balance Due");
});

test("one-cent settlement tolerance returns Paid", () => {
    assert.equal(
        bookingHelpers.calculateOverallPaymentStatus(1000, 499.995, 500),
        "Paid"
    );
});

test("outstanding amount above one cent remains Balance Due", () => {
    assert.equal(
        bookingHelpers.calculateOverallPaymentStatus(1000, 499.98, 500),
        "Balance Due"
    );
});

test("booking currency defaults are AUD 225 and USD 330; LKR is fixed at 1", () => {
    const updateFunction = extractFunction(
        bookingSource,
        "updateBookingExchangeRateField"
    );
    const elements = {
        addBookingCurrency: { value: "AUD", dataset: {} },
        addExchangeRate: { value: "0", disabled: false },
        addExchangeRateLabel: { textContent: "" }
    };
    const update = new Function(
        "document",
        "DEFAULT_EXCHANGE_RATES_TO_LKR",
        updateFunction + "\nreturn updateBookingExchangeRateField;"
    )(
        { getElementById: id => elements[id] || null },
        { AUD: 225, USD: 330 }
    );

    update();
    assert.equal(elements.addExchangeRate.value, "225");
    assert.equal(elements.addExchangeRate.disabled, false);
    assert.equal(elements.addExchangeRateLabel.textContent, "Exchange Rate (1 AUD = LKR)");

    elements.addExchangeRate.value = "230";
    update();
    assert.equal(elements.addExchangeRate.value, "230", "Manual override should remain editable.");

    elements.addBookingCurrency.value = "USD";
    update();
    assert.equal(elements.addExchangeRate.value, "330");
    assert.equal(elements.addExchangeRateLabel.textContent, "Exchange Rate (1 USD = LKR)");

    elements.addBookingCurrency.value = "LKR";
    update();
    assert.equal(elements.addExchangeRate.value, "1");
    assert.equal(elements.addExchangeRate.disabled, true);
    assert.equal(elements.addExchangeRateLabel.textContent, "Exchange Rate (not required for LKR)");
});

test("deposit and balance payment currencies default AUD/USD and lock LKR at 1", () => {
    const updateFunction = extractFunction(
        bookingSource,
        "updatePaymentExchangeRateField"
    );
    const elements = {
        addDepositPaymentCurrency: { value: "AUD", dataset: {} },
        addDepositPaymentExchangeRate: { value: "", disabled: false },
        addBalancePaymentCurrency: { value: "USD", dataset: {} },
        addBalancePaymentExchangeRate: { value: "", disabled: false }
    };
    const update = new Function(
        "document",
        "DEFAULT_EXCHANGE_RATES_TO_LKR",
        updateFunction + "\nreturn updatePaymentExchangeRateField;"
    )(
        { getElementById: id => elements[id] || null },
        { AUD: 225, USD: 330 }
    );

    update("addDepositPaymentCurrency", "addDepositPaymentExchangeRate");
    update("addBalancePaymentCurrency", "addBalancePaymentExchangeRate");

    assert.equal(elements.addDepositPaymentExchangeRate.value, "225");
    assert.equal(elements.addBalancePaymentExchangeRate.value, "330");

    elements.addDepositPaymentCurrency.value = "LKR";
    update("addDepositPaymentCurrency", "addDepositPaymentExchangeRate");
    assert.equal(elements.addDepositPaymentExchangeRate.value, "1");
    assert.equal(elements.addDepositPaymentExchangeRate.disabled, true);

    elements.addBalancePaymentCurrency.value = "AUD";
    update("addBalancePaymentCurrency", "addBalancePaymentExchangeRate");
    assert.equal(elements.addBalancePaymentExchangeRate.value, "225");
    assert.equal(elements.addBalancePaymentExchangeRate.disabled, false);
});
